package dev.barrelmaker.obscura

import android.content.SharedPreferences
import android.util.Log
import dev.barrelmaker.obscura.kit.persistence.SessionStorage
import org.json.JSONObject

/**
 * Android-backed [SessionStorage] for the kit, on a dedicated SharedPreferences
 * file. The kit owns *what* to persist and *when* (connect + token rotation);
 * this just reads/writes the blob, so there is no second, app-owned session
 * state machine.
 *
 * Honors the [SessionStorage] replace-whole-blob contract: [save] replaces the
 * whole blob with exactly `data` — so a key absent from `data` is gone.
 * Callers load-merge-save, so nothing is dropped. Values are String or Int
 * (registrationId).
 *
 * The blob holds refresh/access tokens, so it is stored as one JSON string
 * wrapped by [LocalKeystore], never as plaintext preferences. A blob written as
 * plaintext keys by an earlier build is re-saved wrapped on first [load].
 */
class SharedPreferencesSessionStorage(
    private val prefs: SharedPreferences
) : SessionStorage {

    override fun save(data: Map<String, Any?>) {
        val json = JSONObject()
        for ((key, value) in data) {
            when (value) {
                null -> { /* omit — replace semantics: absent key = not stored */ }
                is Number -> json.put(key, value.toInt())
                is Boolean -> json.put(key, value)
                else -> json.put(key, value.toString())
            }
        }
        // commit() (synchronous) rather than apply(): the persisted refresh token
        // is single-use and rotated on every refresh. If the process dies before an
        // async apply() reaches disk, a consumed refresh token would be restored on
        // next launch and 401 — the exact failure this storage exists to prevent.
        prefs.edit()
            .clear()
            .putString(BLOB, LocalKeystore.wrap(json.toString().toByteArray(Charsets.UTF_8)))
            .commit()
    }

    override fun load(): Map<String, Any?>? {
        val wrapped = prefs.getString(BLOB, null)
        if (wrapped == null) {
            // Plaintext keys from an earlier build: migrate them into the wrapped blob.
            val legacy = prefs.all
            if (legacy.isEmpty()) return null
            save(legacy)
            return legacy
        }
        val plaintext = try {
            LocalKeystore.unwrap(wrapped)
        } catch (e: LocalKeystore.SecretUnavailableException) {
            // The tokens are unrecoverable. Treat it as signed out rather than failing every launch.
            Log.e(TAG, "session blob unreadable; clearing it", e)
            clear()
            return null
        }
        val json = JSONObject(String(plaintext, Charsets.UTF_8))
        return json.keys().asSequence().associateWith { json.get(it) }
    }

    override fun clear() {
        prefs.edit().clear().commit()
    }

    private companion object {
        const val TAG = "SessionStorage"
        const val BLOB = "session_blob"
    }
}
