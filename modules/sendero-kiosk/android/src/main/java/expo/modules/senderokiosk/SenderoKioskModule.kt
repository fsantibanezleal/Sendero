package expo.modules.senderokiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * SenderoKiosk: kiosk mode of the altar tablet (docs/kiosk.md).
 *
 * As device owner the app allowlists itself for lock task mode, becomes the persistent HOME
 * activity, keeps the screen on while plugged and blocks the escape routes; without device owner
 * it falls back to screen pinning. The JS contract lives in modules/sendero-kiosk/src/SenderoKioskModule.ts.
 */
class SenderoKioskModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "React context unavailable", null)

  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private val admin: ComponentName
    get() = ComponentName(context, SenderoAdminReceiver::class.java)

  private val prefs
    get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun deviceOwner(): Boolean = dpm.isDeviceOwnerApp(context.packageName)

  private fun lockTaskState(): Int {
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return am.lockTaskModeState
  }

  override fun definition() = ModuleDefinition {
    Name("SenderoKiosk")

    Function("isDeviceOwner") { deviceOwner() }

    Function("kioskState") {
      when (lockTaskState()) {
        ActivityManager.LOCK_TASK_MODE_LOCKED -> "locked"
        ActivityManager.LOCK_TASK_MODE_PINNED -> "pinned"
        else -> "off"
      }
    }

    AsyncFunction("enterKiosk") { promise: Promise ->
      val activity = appContext.currentActivity
        ?: return@AsyncFunction promise.reject(CodedException("ERR_NO_ACTIVITY", "No foreground activity", null))
      activity.runOnUiThread {
        try {
          val owner = deviceOwner()
          if (owner) applyDeviceOwnerPolicies(activity)
          activity.startLockTask()
          prefs.edit().putBoolean(KEY_ENABLED, true).apply()
          promise.resolve(if (owner) "locked" else "pinned")
        } catch (e: Exception) {
          promise.reject(CodedException("ERR_KIOSK_ENTER", e.message ?: "enterKiosk failed", e))
        }
      }
    }

    AsyncFunction("exitKiosk") { promise: Promise ->
      val activity = appContext.currentActivity
      val work = {
        try {
          prefs.edit().putBoolean(KEY_ENABLED, false).apply()
          releaseLockTask(activity)
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject(CodedException("ERR_KIOSK_EXIT", e.message ?: "exitKiosk failed", e))
        }
      }
      if (activity != null) activity.runOnUiThread(work) else work()
    }

    AsyncFunction("releaseDeviceOwner") { promise: Promise ->
      val activity = appContext.currentActivity
      val work = {
        try {
          prefs.edit().putBoolean(KEY_ENABLED, false).apply()
          releaseLockTask(activity)
          if (deviceOwner()) {
            @Suppress("DEPRECATION")
            dpm.clearDeviceOwnerApp(context.packageName)
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject(CodedException("ERR_KIOSK_RELEASE", e.message ?: "releaseDeviceOwner failed", e))
        }
      }
      if (activity != null) activity.runOnUiThread(work) else work()
    }

    Function("externalMusicDirectory") {
      context.getExternalFilesDir("music")?.also { it.mkdirs() }?.absolutePath ?: ""
    }

    Function("setKioskEnabled") { enabled: Boolean ->
      prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    Function("isKioskEnabled") { prefs.getBoolean(KEY_ENABLED, false) }

    // The kiosk survives a reboot (the app is the persistent HOME activity) and an accidental exit.
    OnActivityEntersForeground {
      val activity = appContext.currentActivity ?: return@OnActivityEntersForeground
      if (!prefs.getBoolean(KEY_ENABLED, false)) return@OnActivityEntersForeground
      if (!deviceOwner() || !dpm.isLockTaskPermitted(context.packageName)) return@OnActivityEntersForeground
      activity.runOnUiThread {
        try {
          if (lockTaskState() == ActivityManager.LOCK_TASK_MODE_NONE) activity.startLockTask()
        } catch (_: Exception) {
          // The next resume tries again; a failure here must never crash the altar app.
        }
      }
    }
  }

  /** Everything a device owner sets for the kiosk (research D1). */
  private fun applyDeviceOwnerPolicies(activity: Activity) {
    val pkg = context.packageName
    val dpm = dpm
    val admin = admin
    dpm.setLockTaskPackages(admin, arrayOf(pkg))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
    }
    dpm.clearPackagePersistentPreferredActivities(admin, pkg)
    dpm.addPersistentPreferredActivity(admin, homeFilter(), activity.componentName)
    val plugged = BatteryManager.BATTERY_PLUGGED_AC or BatteryManager.BATTERY_PLUGGED_USB or
      BatteryManager.BATTERY_PLUGGED_WIRELESS
    dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, plugged.toString())
    for (restriction in restrictions()) dpm.addUserRestriction(admin, restriction)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) dpm.setKeyguardDisabled(admin, true)
    dpm.setStatusBarDisabled(admin, true)
  }

  /** Reverses applyDeviceOwnerPolicies and leaves lock task mode; never throws when already off. */
  private fun releaseLockTask(activity: Activity?) {
    try {
      activity?.stopLockTask()
    } catch (_: Exception) {
      // Not in lock task mode: nothing to stop.
    }
    if (!deviceOwner()) return
    val pkg = context.packageName
    val dpm = dpm
    val admin = admin
    attempt { dpm.setLockTaskPackages(admin, emptyArray()) }
    attempt {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS)
      }
    }
    attempt { dpm.clearPackagePersistentPreferredActivities(admin, pkg) }
    attempt { dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "0") }
    for (restriction in restrictions() + UserManager.DISALLOW_CREATE_WINDOWS) {
      attempt { dpm.clearUserRestriction(admin, restriction) }
    }
    attempt { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) dpm.setKeyguardDisabled(admin, false) }
    attempt { dpm.setStatusBarDisabled(admin, false) }
  }

  private fun restrictions(): List<String> {
    val list = mutableListOf(
      UserManager.DISALLOW_SAFE_BOOT,
      UserManager.DISALLOW_FACTORY_RESET,
      UserManager.DISALLOW_ADD_USER,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) list.add(UserManager.DISALLOW_SYSTEM_ERROR_DIALOGS)
    return list
  }

  private fun homeFilter() = IntentFilter(Intent.ACTION_MAIN).apply {
    addCategory(Intent.CATEGORY_HOME)
    addCategory(Intent.CATEGORY_DEFAULT)
  }

  private inline fun attempt(block: () -> Unit) {
    try {
      block()
    } catch (_: Exception) {
      // One policy that this device refuses must not stop the others from being reversed.
    }
  }

  private companion object {
    const val PREFS = "sendero_kiosk"
    const val KEY_ENABLED = "enabled"
  }
}
