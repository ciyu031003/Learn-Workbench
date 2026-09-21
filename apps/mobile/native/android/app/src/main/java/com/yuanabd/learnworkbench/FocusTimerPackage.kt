package com.yuanabd.learnworkbench

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * 专注计时前台服务（v12 P0-8）的 JS 桥。
 * 项目是 bare 工程、没走 prebuild，所以这里手写 ReactPackage 并注册到 MainApplication。
 */
class FocusTimerPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(FocusTimerModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
