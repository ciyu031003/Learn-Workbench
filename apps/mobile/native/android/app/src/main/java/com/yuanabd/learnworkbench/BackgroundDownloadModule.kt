package com.yuanabd.learnworkbench

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * 系统 DownloadManager 的后台下载桥（v1.58.0 P10 · 移动端 OTA 熄屏断下载）。
 *
 * ## 为什么要换掉 expo-file-system
 * 老实现（[apps/mobile/src/lib/update-manager.ts] 的 ApkDownloader）是 **JS 线程内的前台下载**：
 * 屏幕一灭、App 进后台，进程被系统降级/冻结，TCP 连接随即断掉 → 用户看到"下载失败"，
 * 而且 60MB 的包没有任何续传保障。
 *
 * DownloadManager 是 **system_server 里的系统服务**，下载在它的进程里跑：
 *  - 熄屏 / 切后台 / 划掉最近任务都不中断（系统按前台服务级别调度）；
 *  - 通知栏/控制中心有系统自带的进度与完成通知（VISIBILITY_VISIBLE_NOTIFY_COMPLETED）；
 *  - 任务落库（downloads.db），**App 被杀、重启后仍可用 id 查询** → JS 侧据此"认领"；
 *  - 断网会自动暂停、恢复网络后自动续传（COLUMN_STATUS = PAUSED 时给 UI 显示）。
 *
 * ## 设计约束（与 FocusTimerModule / CrashLogModule 一致）
 *  - 文件落在 **app-specific 外部目录**（getExternalFilesDir/DIRECTORY_DOWNLOADS/updates/），
 *    免存储权限、卸载即清理；下载完由 JS 复制到 cacheDirectory/updates/ 再走既有
 *    大小 + sha256 校验与系统安装器（校验绝不能省）。
 *  - 原生侧只做"搬运系统状态"，**不做业务判断**：进度单位是字节，status 是字符串常量，
 *    JS 端负责文案与流程。
 *  - 任何异常都必须 reject 成结构化 code（E_*），绝不抛崩溃：这段代码在升级链路上，
 *    取证/下载链路自己不能成为新的崩溃源。
 *
 * 幂等注入：手写原生模块不走 prebuild，由 MainApplication 注册 ReactPackage；
 * 若下次 clean prebuild，请把本文件同步到 apps/mobile/native/android 对应目录，
 * 并加入 scripts/apply-android-native.mjs 的 FILES / REACT_PACKAGES（见交付说明）。
 */
class BackgroundDownloadModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "BackgroundDownload"

  private fun manager(): DownloadManager? =
    reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager

  /**
   * 入队系统下载任务。
   *
   * @param url APK 直链（需 http(s)，系统 DownloadManager 不支持自定义 header）
   * @param fileName 目标文件名（只允许 [0-9A-Za-z._-]，防止路径穿越）
   * @param title 通知标题（缺省「应用更新」）
   * @param description 通知副标题（缺省提示下载完成后自动安装）
   * @return 下载任务 id（Number，JS 侧持久化后用于重启认领）
   */
  @ReactMethod
  fun enqueue(url: String?, fileName: String?, title: String?, description: String?, promise: Promise) {
    try {
      val dm = manager()
      if (dm == null) {
        promise.reject("E_DM_UNAVAILABLE", "系统下载服务不可用")
        return
      }
      val targetUrl = url?.trim().orEmpty()
      if (targetUrl.isEmpty()) {
        promise.reject("E_URL_EMPTY", "下载地址为空")
        return
      }
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        promise.reject("E_URL_UNSUPPORTED", "下载地址必须是 http(s)")
        return
      }
      val safeName = sanitizeFileName(fileName)
      val request = DownloadManager.Request(Uri.parse(targetUrl)).apply {
        setTitle(title?.takeIf { it.isNotBlank() } ?: "应用更新")
        setDescription(description?.takeIf { it.isNotBlank() } ?: "下载完成后会自动打开安装器")
        // 进度通知 + 完成通知（完成通知点按可直接打开安装器）
        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        // app-specific 外部目录：无需存储权限，卸载时随应用清理
        setDestinationInExternalFilesDir(
          reactApplicationContext,
          Environment.DIRECTORY_DOWNLOADS,
          "updates/" + safeName,
        )
        setMimeType("application/vnd.android.package-archive")
        // 允许移动网络下载（大版本更新常见场景）；漫游默认关闭，避免用户流量账单意外
        setAllowedOverMetered(true)
        setAllowedOverRoaming(false)
      }
      val id = dm.enqueue(request)
      promise.resolve(id.toDouble())
    } catch (t: Throwable) {
      promise.reject("E_ENQUEUE_FAILED", t.message ?: "无法创建后台下载任务", t)
    }
  }

  /**
   * 查询任务快照。
   *
   * @return { status, downloadedBytes, totalBytes, localUri, reason }；
   *         status 取 pending / running / paused / successful / failed / unknown；
   *         任务被系统清理（用户清了下载记录）时 resolve(null)，JS 侧按"记录丢失"处理。
   */
  @ReactMethod
  fun query(id: Double, promise: Promise) {
    try {
      val dm = manager()
      if (dm == null) {
        promise.reject("E_DM_UNAVAILABLE", "系统下载服务不可用")
        return
      }
      if (id.isNaN() || id <= 0) {
        promise.resolve(null)
        return
      }
      val cursor = try {
        dm.query(DownloadManager.Query().setFilterById(id.toLong()))
      } catch (t: Throwable) {
        promise.reject("E_QUERY_FAILED", t.message ?: "下载状态查询失败", t)
        return
      }
      if (cursor == null) {
        promise.resolve(null)
        return
      }
      cursor.use { c ->
        if (!c.moveToFirst()) {
          promise.resolve(null)
          return
        }
        val statusCode = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        val map = Arguments.createMap()
        map.putString("status", statusName(statusCode))
        map.putDouble(
          "downloadedBytes",
          c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).toDouble(),
        )
        // 总大小在拿到 Content-Length 之前是 -1
        map.putDouble(
          "totalBytes",
          c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).toDouble(),
        )
        val localUri = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
        if (localUri.isNullOrBlank()) map.putNull("localUri") else map.putString("localUri", localUri)
        val reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
        map.putString("reason", reasonName(statusCode, reason))
        promise.resolve(map)
      }
    } catch (t: Throwable) {
      promise.reject("E_QUERY_FAILED", t.message ?: "下载状态查询失败", t)
    }
  }

  /**
   * 取消任务（DownloadManager 不支持 pause/resume，取消即 remove）。
   * 已下载的半包由系统清掉；返回值 true 表示确实移除了一个任务。
   */
  @ReactMethod
  fun cancel(id: Double, promise: Promise) {
    try {
      val dm = manager()
      if (dm == null) {
        promise.reject("E_DM_UNAVAILABLE", "系统下载服务不可用")
        return
      }
      if (id.isNaN() || id <= 0) {
        promise.resolve(false)
        return
      }
      val removed = dm.remove(id.toLong())
      promise.resolve(removed > 0)
    } catch (t: Throwable) {
      promise.reject("E_CANCEL_FAILED", t.message ?: "取消后台下载失败", t)
    }
  }

  /**
   * 清掉任务记录（安装包已复制到 cache 并校验通过后调用，避免下载管理器里堆积历史条目）。
   * 只删记录，不删文件 —— 文件由 JS 侧按 localUri 自己删，避免误删用户数据。
   */
  @ReactMethod
  fun clear(id: Double, promise: Promise) {
    try {
      val dm = manager()
      if (dm == null) {
        promise.resolve(null)
        return
      }
      if (!id.isNaN() && id > 0) {
        dm.remove(id.toLong())
      }
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_CLEAR_FAILED", t.message ?: "清理下载记录失败", t)
    }
  }

  /** 文件名白名单：只留 [0-9A-Za-z._-]，防止 ../ 之类的路径穿越 */
  private fun sanitizeFileName(fileName: String?): String {
    val cleaned = (fileName ?: "").replace(Regex("[^0-9A-Za-z._-]"), "")
    return cleaned.ifBlank { "update.apk" }
  }

  private fun statusName(status: Int): String = when (status) {
    DownloadManager.STATUS_PENDING -> "pending"
    DownloadManager.STATUS_RUNNING -> "running"
    DownloadManager.STATUS_PAUSED -> "paused"
    DownloadManager.STATUS_SUCCESSFUL -> "successful"
    DownloadManager.STATUS_FAILED -> "failed"
    else -> "unknown"
  }

  /**
   * reason 只在 failed 时有意义；其余状态统一回 "none"，避免 JS 把 0 当成错误码。
   * 与 JS 侧 background-download.ts 的 describeBackgroundDownloadFailure 保持同一张表。
   */
  private fun reasonName(status: Int, reason: Int): String {
    if (status != DownloadManager.STATUS_FAILED) return "none"
    return when (reason) {
      DownloadManager.ERROR_UNKNOWN -> "unknown"
      DownloadManager.ERROR_FILE_ALREADY_EXISTS -> "file_already_exists"
      DownloadManager.ERROR_FILE_ERROR -> "file_error"
      DownloadManager.ERROR_HTTP_DATA_ERROR -> "http_data_error"
      DownloadManager.ERROR_INSUFFICIENT_SPACE -> "insufficient_space"
      DownloadManager.ERROR_TOO_MANY_REDIRECTS -> "too_many_redirects"
      DownloadManager.ERROR_UNHANDLED_HTTP_CODE -> "unhandled_http_code"
      // 以下三个常量是 @hide（SDK stub 里没有公开符号），按 AOSP 数值落，注释标出原名
      1003 -> "network" // ERROR_NETWORK
      1011 -> "network_not_available" // ERROR_NETWORK_NOT_AVAILABLE
      1008 -> "blocked" // ERROR_BLOCKED
      DownloadManager.ERROR_CANNOT_RESUME -> "cannot_resume"
      DownloadManager.ERROR_DEVICE_NOT_FOUND -> "device_not_found"
      else -> if (reason >= 400 && reason < 600) "http_" + reason else "unknown_" + reason
    }
  }
}
