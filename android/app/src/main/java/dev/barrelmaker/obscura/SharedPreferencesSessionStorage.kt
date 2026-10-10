package dev.barrelmaker.obscura

import android.content.SharedPreferences
import android.util.Log
import dev.barrelmaker.obscura.kit.persistence.SessionStorage
import org.json.JSONObject

/**
 * The kit's [SessionStorage]: the whole session as one JSON blob wrapped by [LocalKeystore],
 * because it holds the refresh token. [save] replaces the blob entirely.
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
        // Synchronous: refresh tokens are single-use, so losing a write to process death means a 401.
        prefs.edit()
            .clear()
            .putString(BLOB, LocalKeystore.wrap(json.toString().toByteArray(Charsets.UTF_8)))
            .commit()
    }

    override fun load(): Map<String, Any?>? {
        val wrapped = prefs.getString(BLOB, null) ?: return null
        val plaintext = try {
            LocalKeystore.unwrap(wrapped)
        } catch (e: LocalKeystore.SecretUnavailableException) {
            Log.e(TAG, "session blob unreadable; signing out", e)
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
