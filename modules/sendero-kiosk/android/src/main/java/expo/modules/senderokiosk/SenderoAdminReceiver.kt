package expo.modules.senderokiosk

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.UserManager

/**
 * Device admin receiver of Sendero. The adb provisioning command makes this component the device
 * owner. While lock task mode runs, other apps may not create windows (toasts, overlays).
 */
class SenderoAdminReceiver : DeviceAdminReceiver() {
  override fun onLockTaskModeEntering(context: Context, intent: Intent, pkg: String) {
    setCreateWindowsBlocked(context, true)
  }

  override fun onLockTaskModeExiting(context: Context, intent: Intent) {
    setCreateWindowsBlocked(context, false)
  }

  private fun setCreateWindowsBlocked(context: Context, blocked: Boolean) {
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    if (!dpm.isDeviceOwnerApp(context.packageName)) return
    val admin = getWho(context)
    try {
      if (blocked) dpm.addUserRestriction(admin, UserManager.DISALLOW_CREATE_WINDOWS)
      else dpm.clearUserRestriction(admin, UserManager.DISALLOW_CREATE_WINDOWS)
    } catch (_: SecurityException) {
      // Not allowed on this device: lock task mode itself is unaffected.
    }
  }
}
