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
    /**
     * 真机闪退修复（v1.27.1）：Android 12+ 从非法状态拉起前台服务会抛
     * ForegroundServiceStartNotAllowedException；Android 14 还可能是
     * MissingForegroundServiceTypeException / SecurityException。
     * 这里**必须吞掉**：常驻通知只是锦上添花，App 内计时（focus-elapsed）才是单一事实源，
     * 任何原生异常都不允许把 App 打崩。
     */
    try {
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
    } catch (t: Throwable) {
      // 静默降级：没有常驻通知，App 内计时照常
    }
  }

  /** 暂停 / 改标题时用（不重启服务，只更新参数） */
  @ReactMethod
  fun update(title: String, mode: String, totalMs: Double, startAtMs: Double) {
    start(title, mode, totalMs, startAtMs)
  }

  @ReactMethod
  fun stop() {
    /**
     * 真机闪退修复（v1.27.1）：原来用 startService，而 Android 8+ 在**后台**启动服务会抛
     * IllegalStateException: Not allowed to start service Intent —— 暂停 / 关弹层时恰好可能已退到后台。
     * stopService 不受后台启动限制，且服务销毁时系统会一并移除前台通知。
     */
    try {
      reactContext.stopService(Intent(reactContext, FocusTimerService::class.java))
    } catch (t: Throwable) {
      // 静默
    }
  }
}
