package com.yuanabd.learnworkbench

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * 计时期间把「前台服务 + 常驻通知」拉起来：
 * - 倒计时：通知左侧是**倒计时圆环**，右侧是任务 / 习惯名与剩余时间；
 * - 正向计时：圆环按已用时间增长。
 * 进程被杀时服务也会被系统清理，但时间由 startAtMs 决定，回到 App 后重新对齐（见 lib/focus-elapsed.ts）。
 */
class FocusTimerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FocusTimer"

  @ReactMethod
  fun start(title: String, mode: String, totalMs: Double, startAtMs: Double) {
    val intent = Intent(reactContext, FocusTimerService::class.java).apply {
      putExtra(FocusTimerService.EXTRA_TITLE, title)
      putExtra(FocusTimerService.EXTRA_MODE, mode)
      putExtra(FocusTimerService.EXTRA_TOTAL_MS, totalMs.toLong())
      putExtra(FocusTimerService.EXTRA_START_AT, startAtMs.toLong())
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent)
    } else {
      reactContext.startService(intent)
    }
  }

  /** 暂停 / 改标题时用（不重启服务，只更新参数） */
  @ReactMethod
  fun update(title: String, mode: String, totalMs: Double, startAtMs: Double) {
    start(title, mode, totalMs, startAtMs)
  }

  @ReactMethod
  fun stop() {
    val intent = Intent(reactContext, FocusTimerService::class.java).setAction(FocusTimerService.ACTION_STOP)
    reactContext.startService(intent)
  }
}
