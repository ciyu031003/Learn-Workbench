package com.yuanabd.learnworkbench

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * 崩溃取证的**原生半边**（v1.32.0，招花滑动闪退排查）。
 *
 * 为什么需要它：招花闪退是**进程级死亡**，JS 在崩溃瞬间已经没了 —— ErrorUtils / try-catch /
 * 写文件都来不及。Android 11(API 30)+ 提供了唯一无需 root 的官方取回方式：
 *   ActivityManager.getHistoricalProcessExitReasons() → ApplicationExitInfo.getTraceInputStream()
 * 它能给出上一次进程退出的**原因**（CRASH_NATIVE / ANR / SIGNALED…）与**native 崩溃栈**
 * （debuggerd 生成的 tombstone 内容），正好是我们缺的那块拼图。
 *
 * 设计约束（与 FocusTimerModule 一致，见 apps/mobile/CLAUDE.md）：
 *  - 任何异常都必须吞掉并回 null/空串 —— **取证链路自己绝不能成为新的闪退源**；
 *  - 低版本（< API 30）直接回 null，由 JS 端降级为"只有面包屑，没有原生栈"。
 *
 * 幂等注入：本文件由 scripts/apply-android-native.mjs 复制到 android/ 并注册 ReactPackage。
 */
class CrashLogModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "CrashLog"

  /** 崩溃栈上限：native tombstone 可能很大，截断避免把 JS 线程/上报体积拖垮 */
  private val maxTraceChars = 200_000

  /**
   * 最近一次进程退出记录（最新一条 = 上一次运行；当前进程不在列表里）。
   * 返回 { reason, reasonCode, timestamp, description, trace } 或 null。
   */
  @ReactMethod
  fun getLastExitInfo(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(null)
      return
    }
    try {
      val am = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      val infos = am?.getHistoricalProcessExitReasons(reactApplicationContext.packageName, 0, 5)
      if (infos.isNullOrEmpty()) {
        promise.resolve(null)
        return
      }
      val info = infos[0]
      val map = Arguments.createMap()
      map.putString("reason", reasonName(info.reason))
      map.putInt("reasonCode", info.reason)
      map.putDouble("timestamp", info.timestamp.toDouble())
      map.putString("description", info.description ?: "")
      map.putString("trace", readTrace(info))
      promise.resolve(map)
    } catch (t: Throwable) {
      // 读取失败（ROM 限制 / 权限 / 文件损坏）：回 null，绝不 reject（reject 会在 JS 侧变成噪音）
      promise.resolve(null)
    }
  }

  /**
   * 兜底通道：应用自身可见的 logcat（Android 4.1+ 只能读到本 uid 的日志）。
   * Java 崩溃（AndroidRuntime FATAL EXCEPTION）由本进程打印，能拿到；
   * native 崩溃由 debuggerd 打印，多数被过滤 —— 所以它只是补充，不是主通道。
   */
  @ReactMethod
  fun dumpLogcat(maxBytes: Double, promise: Promise) {
    try {
      val limit = maxBytes.toInt().coerceIn(16 * 1024, 2 * 1024 * 1024)
      val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-v", "threadtime", "-t", "3000"))
      val text = process.inputStream.bufferedReader().use { it.readText() }
      process.destroy()
      promise.resolve(if (text.length > limit) text.takeLast(limit) else text)
    } catch (t: Throwable) {
      promise.resolve("")
    }
  }

  private fun readTrace(info: ApplicationExitInfo): String {
    val stream = try {
      info.traceInputStream
    } catch (t: Throwable) {
      null
    } ?: return ""
    return try {
      stream.use { s ->
        val sb = StringBuilder()
        BufferedReader(InputStreamReader(s, Charsets.UTF_8)).use { reader ->
          val buf = CharArray(8192)
          while (sb.length < maxTraceChars) {
            val n = reader.read(buf)
            if (n <= 0) break
            sb.append(buf, 0, minOf(n, maxTraceChars - sb.length))
          }
        }
        sb.toString()
      }
    } catch (t: Throwable) {
      ""
    }
  }

  /** 与 JS 端 crash-report.ts 的 REASON_NAMES 保持同一张表（两边都改，别只改一处） */
  private fun reasonName(reason: Int): String = when (reason) {
    ApplicationExitInfo.REASON_UNKNOWN -> "UNKNOWN"
    ApplicationExitInfo.REASON_EXIT_SELF -> "EXIT_SELF"
    ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
    ApplicationExitInfo.REASON_CRASH -> "CRASH"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
    ApplicationExitInfo.REASON_ANR -> "ANR"
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
    ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "PERMISSION_CHANGE"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
    ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED"
    ApplicationExitInfo.REASON_USER_STOPPED -> "USER_STOPPED"
    ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
    ApplicationExitInfo.REASON_OTHER -> "OTHER"
    ApplicationExitInfo.REASON_FREEZER -> "FREEZER"
    ApplicationExitInfo.REASON_PACKAGE_STATE_CHANGE -> "PACKAGE_STATE_CHANGE"
    ApplicationExitInfo.REASON_PACKAGE_UPDATED -> "PACKAGE_UPDATED"
    else -> "REASON_" + reason
  }
}
