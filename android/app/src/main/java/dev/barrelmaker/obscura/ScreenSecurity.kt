package dev.barrelmaker.obscura

import android.app.Activity
import android.view.WindowManager

/**
 * Blocks screenshots, screen recording, casting, and the recent-apps thumbnail. With
 * `FLAG_SECURE` the system renders the window as blank on every capture path.
 */
object ScreenSecurity {
    fun protect(activity: Activity) {
        activity.window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
    }
}
