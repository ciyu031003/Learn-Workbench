package com.yuanabd.learnworkbench

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import android.widget.RemoteViews

/**
 * 专注计时前台服务（v12 P0-8）：
 * 让「一键开始 / 学习计时」在后台不被杀，并在通知栏常驻一个**自定义布局**：
 *   左侧 = 圆环（倒计时按剩余、正计时按已用），右侧 = 当前任务 / 习惯名 + 时间。
 */
class FocusTimerService : Service() {

  companion object {
    const val CHANNEL_ID = "focus-timer"
    const val NOTIFICATION_ID = 4821
    const val EXTRA_TITLE = "title"
    const val EXTRA_MODE = "mode"
    const val EXTRA_TOTAL_MS = "totalMs"
    const val EXTRA_START_AT = "startAtMs"
    const val ACTION_STOP = "com.yuanabd.learnworkbench.STOP_FOCUS"
    private const val RING_PX = 132
  }

  private val handler = Handler(Looper.getMainLooper())
  private var title: String = "学习中"
  private var mode: String = "countdown"
  private var totalMs: Long = 0L
  private var startAtMs: Long = 0L
  private var running = false

  private val ticker = object : Runnable {
    override fun run() {
      if (!running) return
      // 每秒刷新通知：任何异常（通知被系统禁用、RemoteViews 失效等）都必须吞掉，
      // 否则 handler 里的未捕获异常会直接崩掉 App。
      try {
        pushNotification()
      } catch (t: Throwable) {
        // 忽略：下一拍继续尝试
      }
      handler.postDelayed(this, 1000L)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      running = false
      handler.removeCallbacks(ticker)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    intent?.let {
      title = it.getStringExtra(EXTRA_TITLE) ?: title
      mode = it.getStringExtra(EXTRA_MODE) ?: mode
      totalMs = it.getLongExtra(EXTRA_TOTAL_MS, totalMs)
      startAtMs = it.getLongExtra(EXTRA_START_AT, System.currentTimeMillis())
    }
    if (startAtMs <= 0L) startAtMs = System.currentTimeMillis()

    ensureChannel()
    running = true
    /**
     * 真机闪退修复（v1.27.1）：startForeground 在以下情况会抛未捕获异常并崩掉 App ——
     * 通知权限被拒 / 通道被禁用 / Android 14+ 的前台服务类型不匹配 / 通知体非法。
     * 处理策略：能起就起；起不来就立即 stopSelf()，绝不留下"启动了却没有 startForeground"
     * 的状态（那会触发 ForegroundServiceDidNotStartInTimeException 同样崩 App）。
     */
    if (!startAsForeground()) {
      running = false
      handler.removeCallbacks(ticker)
      stopSelf()
      return START_NOT_STICKY
    }
    handler.removeCallbacks(ticker)
    handler.post(ticker)
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    handler.removeCallbacks(ticker)
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "专注计时",
        NotificationManager.IMPORTANCE_LOW // 常驻但不打扰：不响铃、不弹横幅
      ).apply {
        description = "计时期间的常驻提醒，显示当前任务与进度环"
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun elapsedMs(): Long = (System.currentTimeMillis() - startAtMs).coerceAtLeast(0L)

  /** 圆环位图：底环 + 进度弧（倒计时=已用/总时长 的"消耗"用剩余表示） */
  private fun ringBitmap(progress: Float, sizePx: Int): Bitmap {
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val stroke = sizePx * 0.12f
    val inset = stroke / 2f
    val rect = RectF(inset, inset, sizePx - inset, sizePx - inset)
    val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = stroke
      color = 0x33FFFFFF
    }
    val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = stroke
      strokeCap = Paint.Cap.ROUND
      color = 0xFFFFB25E.toInt() // 与 App 的强调橙一致
    }
    canvas.drawArc(rect, -90f, 360f, false, track)
    canvas.drawArc(rect, -90f, 360f * progress.coerceIn(0f, 1f), false, arc)
    return bmp
  }

  private fun fmt(ms: Long): String {
    val total = (ms.coerceAtLeast(0L)) / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
  }

  private fun buildNotification(): Notification {
    val views = RemoteViews(packageName, R.layout.notification_focus)
    val elapsed = elapsedMs()
    val progress: Float
    val timeText: String
    if (mode == "countdown" && totalMs > 0L) {
      val remain = (totalMs - elapsed).coerceAtLeast(0L)
      progress = if (totalMs > 0) (remain.toFloat() / totalMs.toFloat()) else 0f
      timeText = "剩余 " + fmt(remain)
    } else {
      progress = if (totalMs > 0L) (elapsed.toFloat() / totalMs.toFloat()) else 0f
      timeText = fmt(elapsed)
    }

    views.setImageViewBitmap(R.id.focus_ring, ringBitmap(progress, RING_PX))
    views.setTextViewText(R.id.focus_title, title)
    views.setTextViewText(R.id.focus_time, timeText)

    val open = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = PendingIntent.getActivity(
      this,
      0,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    )
    val stopIntent = PendingIntent.getService(
      this,
      1,
      Intent(this, FocusTimerService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    )
    views.setOnClickPendingIntent(R.id.focus_stop, stopIntent)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setCustomContentView(views)
      .setCustomBigContentView(views)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setContentIntent(contentIntent)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  /** 起前台：成功返回 true；任何异常一律吞掉并返回 false（由调用方 stopSelf） */
  private fun startAsForeground(): Boolean {
    return try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      true
    } catch (t: Throwable) {
      false
    }
  }

  private fun pushNotification() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification())
  }
}
