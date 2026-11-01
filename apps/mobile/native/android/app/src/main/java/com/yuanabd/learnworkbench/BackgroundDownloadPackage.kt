package com.yuanabd.learnworkbench

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * 后台下载模块（v1.58.0 P10）的 JS 桥。
 *
 * 项目是 bare 工程、未走 prebuild（android/ 是生成目录），所以手写 ReactPackage
 * 并在 MainApplication 的 PackageList 里 add 一次；新增模块只加自己那一行，
 * 与 FocusTimerPackage / CrashLogPackage 的注入方式保持一致。
 */
class BackgroundDownloadPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(BackgroundDownloadModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
