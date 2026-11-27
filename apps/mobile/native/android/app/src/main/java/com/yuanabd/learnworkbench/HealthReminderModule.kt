package com.yuanabd.learnworkbench

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * 健康提醒的本地闹钟桥（v2.8.9）。
 *
 * 设计取舍：
 *  - 不引入 expo-notifications，避免为两条生活方式提醒新增精确闹钟 / 开机广播权限；
 *  - 使用 setAndAllowWhileIdle（系统已授权精确闹钟时才用 setExactAndAllowWhileIdle）；
 *  - 只排未来 7 天，App 每次打开时由 JS 取消并重排，规则变化不会残留旧提醒。
 */
class HealthReminderModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val PREFS = "health_reminders"
    const val KEY_IDS = "ids"
    const val EXTRA_ID = "health_reminder_id"
    const val EXTRA_TITLE = "health_reminder_title"
    const val EXTRA_BODY = "health_reminder_body"
  }

  override fun getName(): String = "HealthReminder"

  private fun prefs() = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun requestCode(id: String): Int = id.hashCode() and 0x7fffffff

  private fun pendingIntent(id: String, intent: Intent, flags: Int): PendingIntent? {
    val mutableFlags = flags or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(reactContext, requestCode(id), intent, mutableFlags)
  }

  @ReactMethod
  fun schedule(id: String, title: String, body: String, triggerAtMs: Double) {
    val at = triggerAtMs.toLong()
    if (at <= System.currentTimeMillis()) return
    try {
      val intent = Intent(reactContext, HealthReminderReceiver::class.java).apply {
        putExtra(EXTRA_ID, id)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
      }
      val pi = pendingIntent(id, intent, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
      val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && am.canScheduleExactAlarms()) {
          am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } else {
          am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
      } catch (t: Throwable) {
        // 精确闹钟被系统拒绝时退回非精确；提醒晚几分钟可以接受，不能崩溃
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
      }
      val ids = prefs().getStringSet(KEY_IDS, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
      ids.add(id)
      prefs().edit().putStringSet(KEY_IDS, ids).apply()
    } catch (t: Throwable) {
      // 静默降级：本地通知失败不影响 App
    }
  }

  @ReactMethod
  fun cancel(id: String) {
    try {
      val intent = Intent(reactContext, HealthReminderReceiver::class.java)
      val pi = pendingIntent(id, intent, PendingIntent.FLAG_NO_CREATE)
      if (pi != null) {
        val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pi)
        pi.cancel()
      }
      val ids = prefs().getStringSet(KEY_IDS, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
      ids.remove(id)
      prefs().edit().putStringSet(KEY_IDS, ids).apply()
    } catch (t: Throwable) {
      // 忽略
    }
  }

  @ReactMethod
  fun cancelAll() {
    try {
      val ids = prefs().getStringSet(KEY_IDS, mutableSetOf())?.toList() ?: emptyList()
      for (id in ids) cancel(id)
      prefs().edit().remove(KEY_IDS).apply()
    } catch (t: Throwable) {
      // 忽略
    }
  }
}
