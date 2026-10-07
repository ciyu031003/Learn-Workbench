package com.yuanabd.learnworkbench

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * 崩溃取证模块（v1.32.0）的 JS 桥。
 * 项目是 bare 工程、没走 prebuild，所以手写 ReactPackage 并由
 * scripts/apply-android-native.mjs 幂等注册到 MainApplication。
 */
class CrashLogPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(CrashLogModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
