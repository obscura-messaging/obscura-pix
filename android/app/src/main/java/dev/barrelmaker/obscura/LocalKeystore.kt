package dev.barrelmaker.obscura

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.io.File
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Local secrets at rest, the Android counterpart of the iOS Keychain.
 *
 * One non-exportable AES-256-GCM key lives in the Android Keystore (hardware-backed where the
 * device has a TEE or StrongBox). It never encrypts data directly; it wraps small secrets, the
 * per-user database keys and the session blob, which are stored only in wrapped form.
 */
object LocalKeystore {

    private const val TAG = "LocalKeystore"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val WRAP_ALIAS = "obscura_local_wrap"
    private const val KEYS_PREFS = "obscura_db_keys"
    private const val GCM_IV_BYTES = 12
    private const val GCM_TAG_BITS = 128
    private val random = SecureRandom()

    private fun wrapKey(): SecretKey {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (ks.getKey(WRAP_ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        gen.init(
            KeyGenParameterSpec.Builder(
                WRAP_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    /**
     * Encrypt with the Keystore key. Output is base64(iv || ciphertext+tag).
     *
     * If the Keystore key exists but cannot be used (some OEM Keystores lose or corrupt keys across
     * OS updates), everything it wrapped is already unreadable, so it is replaced rather than
     * leaving the app unable to store any secret again.
     */
    fun wrap(plaintext: ByteArray): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        try {
            cipher.init(Cipher.ENCRYPT_MODE, wrapKey())
        } catch (e: GeneralSecurityException) {
            Log.e(TAG, "Keystore wrap key unusable; replacing it", e)
            KeyStore.getInstance(KEYSTORE).apply { load(null) }.deleteEntry(WRAP_ALIAS)
            cipher.init(Cipher.ENCRYPT_MODE, wrapKey())
        }
        return Base64.encodeToString(cipher.iv + cipher.doFinal(plaintext), Base64.NO_WRAP)
    }

    /** @throws SecretUnavailableException if the secret cannot be recovered. */
    fun unwrap(wrapped: String): ByteArray {
        try {
            val bytes = Base64.decode(wrapped, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                wrapKey(),
                GCMParameterSpec(GCM_TAG_BITS, bytes, 0, GCM_IV_BYTES),
            )
            return cipher.doFinal(bytes, GCM_IV_BYTES, bytes.size - GCM_IV_BYTES)
        } catch (e: GeneralSecurityException) {
            throw SecretUnavailableException(e)
        } catch (e: IllegalArgumentException) {
            throw SecretUnavailableException(e) // malformed base64
        }
    }

    /**
     * A wrapped secret could not be recovered: the Keystore key is gone or unusable, or the stored
     * blob is corrupt. Not transient, so callers recover rather than retry.
     */
    class SecretUnavailableException(cause: Throwable) :
        Exception("local secret could not be unwrapped", cause)

    /**
     * The SQLCipher key for one user's database: 32 random bytes, created on first use.
     *
     * Returned as SQLCipher's raw-key literal (`x'<hex>'`), so the full-entropy key is used as-is
     * instead of being stretched through PBKDF2 on every open.
     */
    fun databaseKey(context: Context, username: String): ByteArray {
        val prefs = context.getSharedPreferences(KEYS_PREFS, Context.MODE_PRIVATE)
        val name = "db_$username"
        val key = prefs.getString(name, null)?.let { unwrap(it) }
            ?: ByteArray(32).also {
                random.nextBytes(it)
                // A key that is not stored would encrypt a database nothing can open again.
                check(prefs.edit().putString(name, wrap(it)).commit()) { "could not store database key" }
            }
        val hex = key.joinToString("") { "%02x".format(it) }
        return "x'$hex'".toByteArray(Charsets.US_ASCII)
    }

    /**
     * Forget one user's database key and delete the database. Used when the database can no
     * longer be decrypted: without its key the data is unrecoverable, so the user starts over as a
     * new device.
     */
    fun discardDatabase(context: Context, username: String, dbName: String) {
        context.getSharedPreferences(KEYS_PREFS, Context.MODE_PRIVATE)
            .edit().remove("db_$username").commit()
        context.deleteDatabase(dbName) // also removes -journal, -wal and -shm
    }

    /**
     * Encrypt an existing plaintext SQLite database in place with [key].
     *
     * No-op when the file is absent or already encrypted. `sqlcipher_export` copies schema and
     * rows but not `user_version`, which SQLDelight uses as its schema version, so that is carried
     * over explicitly.
     */
    fun encryptPlaintextDatabase(context: Context, dbName: String, key: ByteArray) {
        val db = context.getDatabasePath(dbName)
        if (!isPlaintextSqlite(db)) return
        val tmp = File(db.parentFile, "$dbName.encrypting")
        tmp.delete()
        val keyLiteral = String(key, Charsets.US_ASCII)
        // CREATE_IF_NECESSARY: ATTACH inherits these flags, and it must create the target file.
        val plain = net.zetetic.database.sqlcipher.SQLiteDatabase.openDatabase(
            db.path, "", null,
            net.zetetic.database.sqlcipher.SQLiteDatabase.OPEN_READWRITE or
                net.zetetic.database.sqlcipher.SQLiteDatabase.CREATE_IF_NECESSARY,
            null,
        )
        try {
            val version = plain.version
            plain.rawExecSQL("ATTACH DATABASE '${tmp.path}' AS encrypted KEY \"$keyLiteral\"")
            plain.rawQuery("SELECT sqlcipher_export('encrypted')", null).use { it.moveToFirst() }
            plain.rawExecSQL("PRAGMA encrypted.user_version = $version")
            plain.rawExecSQL("DETACH DATABASE encrypted")
        } finally {
            plain.close()
        }
        for (suffix in listOf("", "-wal", "-shm", "-journal")) File(db.path + suffix).delete()
        check(tmp.renameTo(db)) { "could not move encrypted database into place" }
    }

    private fun isPlaintextSqlite(file: File): Boolean {
        if (!file.exists() || file.length() < 16) return false
        val header = ByteArray(16)
        file.inputStream().use { it.read(header) }
        return String(header, Charsets.US_ASCII) == "SQLite format 3\u0000"
    }
}
