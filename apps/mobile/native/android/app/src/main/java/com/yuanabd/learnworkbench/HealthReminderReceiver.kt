package com.yuanabd.learnworkbench

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 健康提醒的落点：只负责画一条普通通知。
 * 点击回到 MainActivity；不携带业务跳转参数，避免冷启动路由竞态。
 */
class HealthReminderReceiver : BroadcastReceiver() {
  companion object {
    const val CHANNEL_ID = "health-reminders"
    const val CHANNEL_NAME = "健康提醒"
  }

  override fun onReceive(context: Context, intent: Intent) {
    try {
      val id = intent.getStringExtra(HealthReminderModule.EXTRA_ID) ?: return
      val title = intent.getStringExtra(HealthReminderModule.EXTRA_TITLE) ?: "健康提醒"
      val body = intent.getStringExtra(HealthReminderModule.EXTRA_BODY) ?: ""

      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
          description = "早睡、补充蛋白质等生活方式提醒"
          enableVibration(true)
        }
        nm.createNotificationChannel(channel)
      }

      val open = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("healthReminder", true)
      }
      val contentIntent = PendingIntent.getActivity(
        context,
        0,
        open,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val builder = Notification.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_health_reminder)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(Notification.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setCategory(Notification.CATEGORY_REMINDER)
        .setVisibility(Notification.VISIBILITY_PRIVATE)
        .setContentIntent(contentIntent)

      nm.notify(id.hashCode() and 0x7fffffff, builder.build())

      // 触发后从未触发集合里移除，下一次同步不会重复取消已完成的闹钟
      val prefs = context.getSharedPreferences(HealthReminderModule.PREFS, Context.MODE_PRIVATE)
      val ids = prefs.getStringSet(HealthReminderModule.KEY_IDS, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
      if (ids.remove(id)) prefs.edit().putStringSet(HealthReminderModule.KEY_IDS, ids).apply()
    } catch (t: Throwable) {
      // 通知失败不能影响系统广播
    }
  }
}
