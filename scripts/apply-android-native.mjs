/**
 * 把「手写原生代码」应用到 android/ 工程（apply-android-native）。
 *
 * 背景：apps/mobile/android 是 .gitignore 的生成目录（prebuild 产物），自写 Kotlin 不能直接提交。
 * 因此自写原生代码统一放在 apps/mobile/native/android/**（已入库），由本脚本在构建前落进 android/，
 * 并幂等地补 Manifest 权限/服务声明与 MainApplication 的 ReactPackage 注册。
 *
 * v2.0.1 起还负责 Health Connect（睡眠读取）的清单接线：权限、<queries> 包名、
 * MainActivity 的权限说明 intent-filter 与 Android 14+ 的 activity-alias ——
 * 这些本来由 react-native-health-connect 的 Expo config plugin 在 prebuild 时补，
 * 而本仓库构建链**不跑 prebuild**（见 scripts/build-android-release.ps1 顶部第 2 条）。
 *
 * 用法：node scripts/apply-android-native.mjs [--check]   （--check 只校验，不写）
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "apps/mobile/native/android");
const DST = path.join(ROOT, "apps/mobile/android");
const CHECK = process.argv.includes("--check");

const FILES = [
  "app/src/main/java/com/yuanabd/learnworkbench/FocusTimerModule.kt",
  "app/src/main/java/com/yuanabd/learnworkbench/FocusTimerPackage.kt",
  "app/src/main/java/com/yuanabd/learnworkbench/FocusTimerService.kt",
  "app/src/main/res/layout/notification_focus.xml",
  // v1.32.0：崩溃取证（Android 11+ ApplicationExitInfo 取 native 崩溃栈 + logcat 兜底）
  "app/src/main/java/com/yuanabd/learnworkbench/CrashLogModule.kt",
  "app/src/main/java/com/yuanabd/learnworkbench/CrashLogPackage.kt",
  // v1.58.0 P10：OTA 后台下载（系统 DownloadManager，熄屏不断、通知栏进度、重启认领）
  "app/src/main/java/com/yuanabd/learnworkbench/BackgroundDownloadModule.kt",
  "app/src/main/java/com/yuanabd/learnworkbench/BackgroundDownloadPackage.kt",
];

/** 需要注册到 MainApplication 的手写 ReactPackage（幂等：已存在就跳过） */
const REACT_PACKAGES = [
  { call: "FocusTimerPackage()", comment: "// 手写原生模块（不走 prebuild）：专注计时前台服务" },
  { call: "CrashLogPackage()", comment: "// 手写原生模块（不走 prebuild）：崩溃取证（ApplicationExitInfo + logcat）" },
  {
    call: "BackgroundDownloadPackage()",
    comment: "// 手写原生模块（不走 prebuild）：OTA 后台下载（系统 DownloadManager，熄屏不断）",
  },
];

/** Manifest：权限 + service 声明（按内容判断，重复执行不会插两遍） */
const PERMISSIONS = [
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
  // v2.0.1 健康页「睡眠记录」：读取 Android Health Connect 的 SleepSessionRecord。
  // 声明后 APK 会多一条权限 —— scripts/build-android-release.ps1 的权限白名单已同步加它，
  // 否则构建末端的 aapt2 断言会直接 FAIL。
  '<uses-permission android:name="android.permission.health.READ_SLEEP"/>',
];

/**
 * Health Connect（v2.0.1）：库 manifest 只声明了 <queries> 包名，权限说明入口必须由宿主补。
 * 参考 react-native-health-connect 的 app.plugin.js，但改成「字符串幂等补丁」，
 * 因为它只在 expo prebuild 时执行，而本仓库不做 prebuild。
 */
const HC_PACKAGE = "com.google.android.apps.healthdata";
const HC_RATIONALE_ACTION = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
const HC_ALIAS = "ViewPermissionUsageActivity";
const HC_ALIAS_BLOCK = [
  '    <!-- Health Connect（Android 14+）：权限说明页入口，系统用 START_VIEW_PERMISSION_USAGE 调起 -->',
  '    <activity-alias',
  '      android:name="ViewPermissionUsageActivity"',
  '      android:exported="true"',
  '      android:targetActivity=".MainActivity"',
  '      android:permission="android.permission.START_VIEW_PERMISSION_USAGE">',
  '      <intent-filter>',
  '        <action android:name="android.intent.action.VIEW_PERMISSION_USAGE"/>',
  '        <category android:name="android.intent.category.HEALTH_PERMISSIONS"/>',
  '      </intent-filter>',
  '    </activity-alias>',
].join("\n");
const SERVICE_BLOCK = [
  '    <!-- 专注计时前台服务：计时期间常驻通知（自定义圆环布局），避免被系统回收 -->',
  '    <service',
  '      android:name=".FocusTimerService"',
  '      android:exported="false"',
  '      android:foregroundServiceType="specialUse">',
  '      <property',
  '        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"',
  '        android:value="focus_timer" />',
  '    </service>',
].join("\n");

function patchManifest(text) {
  let out = text;
  // allowBackup=false（评审 2026-10-31 P3）：业务数据/离线发件箱不随云备份或 adb backup
  // 迁出。app.json 已配 expo.android.allowBackup（管 prebuild），这里兜底管「存量 manifest
  // 未重新 prebuild」的场景：改写或补上 application 标签上的属性（幂等）。
  if (/android:allowBackup="[^"]*"/.test(out)) {
    out = out.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
  } else if (/<application\b/.test(out) && !/android:allowBackup=/.test(out)) {
    out = out.replace(/<application\b/, '<application\n      android:allowBackup="false"');
  }
  for (const p of PERMISSIONS) {
    if (!out.includes(p)) {
      // 插在最后一个 uses-permission 之后
      const idx = out.lastIndexOf("  <uses-permission");
      const lineEnd = out.indexOf("\n", idx);
      out = out.slice(0, lineEnd + 1) + "  " + p + "\n" + out.slice(lineEnd + 1);
    }
  }
  if (!out.includes('android:name=".FocusTimerService"')) {
    out = out.replace("  </application>", SERVICE_BLOCK + "\n  </application>");
  }

  // Health Connect：Android 13- 的健康数据是独立 App（com.google.android.apps.healthdata），
  // 不声明 <queries> 在 Android 11+ 的包可见性下会「看不到对方」。库 manifest 也声明了同一条，
  // 合并期 <queries> 会去重，这里显式补是为了「库换了实现也不掉链子」。
  if (!out.includes(HC_PACKAGE)) {
    if (out.includes("<queries>")) {
      out = out.replace(/([ \t]*)<queries>/, '$1<queries>\n    <package android:name="' + HC_PACKAGE + '" />');
    } else {
      out = out.replace(
        "</manifest>",
        '  <queries>\n    <package android:name="' + HC_PACKAGE + '" />\n  </queries>\n</manifest>'
      );
    }
  }

  // 权限弹窗里的「隐私政策」链接：Android 13 及以下由 MainActivity 直接处理。
  if (!out.includes(HC_RATIONALE_ACTION)) {
    const activityAt = out.indexOf('android:name=".MainActivity"');
    const activityEnd = activityAt >= 0 ? out.indexOf("</activity>", activityAt) : -1;
    const lineStart = activityEnd >= 0 ? out.lastIndexOf("\n", activityEnd) + 1 : -1;
    if (activityEnd >= 0 && lineStart > 0) {
      // 插在 </activity> 那一行的行首（保留它自己的缩进，否则标签会顶格）
      const indent = out.slice(lineStart, activityEnd);
      const block =
        [
          indent + "  <!-- Health Connect（Android 13 及以下）：权限弹窗里的「隐私政策」回到本页 -->",
          indent + "  <intent-filter>",
          indent + '    <action android:name="' + HC_RATIONALE_ACTION + '"/>',
          indent + "  </intent-filter>",
        ].join("\n") + "\n";
      out = out.slice(0, lineStart) + block + out.slice(lineStart);
    }
  }

  // Android 14+ 走 activity-alias（与官方的 ViewPermissionUsageActivity 约定一致）。
  if (!out.includes(HC_ALIAS)) {
    out = out.replace("  </application>", HC_ALIAS_BLOCK + "\n  </application>");
  }
  return out;
}

/**
 * MainApplication：注册手写 ReactPackage（幂等，可重复跑）。
 *
 * 插入点：`PackageList(this).packages.apply { ... }` 块里最后一个 `add(...)` 之后；
 * 块内还没有 add 时插在 apply 行之后。逐个包判断，新增模块只加自己那一行。
 */
function patchMainApplication(text) {
  const missing = REACT_PACKAGES.filter((p) => !text.includes(p.call));
  if (missing.length === 0) return text;
  let lines = text.split("\n");
  for (const pkg of missing) {
    const applyIdx = lines.findIndex((l) => l.includes("PackageList(this).packages.apply {"));
    if (applyIdx < 0) return text; // 结构变了：宁可不改，让构建以"模块未注册"暴露出来
    let lastAdd = -1;
    for (let i = applyIdx + 1; i < lines.length; i++) {
      if (lines[i].trim() === "}") break; // apply 块结束
      if (lines[i].includes("add(")) lastAdd = i;
    }
    const insertAt = lastAdd >= 0 ? lastAdd + 1 : applyIdx + 1;
    // 沿用块内已有 add 行的缩进（RN 模板的包列表可能嵌在 packageList = ... 里），保持文件干净
    const guide = lines[lastAdd >= 0 ? lastAdd : applyIdx];
    const indent = (guide.match(/^\s*/) ?? ["      "])[0];
    lines.splice(insertAt, 0, indent + pkg.comment, indent + "add(" + pkg.call + ")");
  }
  return lines.join("\n");
}

let changed = 0;
for (const rel of FILES) {
  const from = path.join(SRC, rel);
  const to = path.join(DST, rel);
  if (!existsSync(from)) {
    console.error("[native] 缺少源文件：" + rel);
    process.exit(1);
  }
  const src = await readFile(from, "utf8");
  const cur = existsSync(to) ? await readFile(to, "utf8") : null;
  if (cur === src) continue;
  changed++;
  if (!CHECK) {
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    console.log("[native] 写入 " + rel);
  } else {
    console.log("[native] 待更新 " + rel);
  }
}

const manifestPath = path.join(DST, "app/src/main/AndroidManifest.xml");
const mainAppPath = path.join(DST, "app/src/main/java/com/yuanabd/learnworkbench/MainApplication.kt");
for (const [file, patch] of [
  [manifestPath, patchManifest],
  [mainAppPath, patchMainApplication],
]) {
  if (!existsSync(file)) {
    console.error("[native] 找不到 " + path.relative(ROOT, file) + "（先跑一次 android 工程生成 / prebuild）");
    process.exit(1);
  }
  const cur = await readFile(file, "utf8");
  const next = patch(cur);
  if (next === cur) continue;
  changed++;
  if (!CHECK) {
    await writeFile(file, next, "utf8");
    console.log("[native] 已补 " + path.relative(ROOT, file));
  } else {
    console.log("[native] 待补 " + path.relative(ROOT, file));
  }
}

console.log(changed === 0 ? "[native] 已是最新 ✅" : "[native] 应用完成（" + changed + " 处）" + (CHECK ? "（--check 模式未写入）" : ""));
