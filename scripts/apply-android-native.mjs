/**
 * 把「手写原生代码」应用到 android/ 工程（apply-android-native）。
 *
 * 背景：apps/mobile/android 是 .gitignore 的生成目录（prebuild 产物），自写 Kotlin 不能直接提交。
 * 因此自写原生代码统一放在 apps/mobile/native/android/**（已入库），由本脚本在构建前落进 android/，
 * 并幂等地补 Manifest 权限/服务声明与 MainApplication 的 ReactPackage 注册。
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
];

/** Manifest：权限 + service 声明（按内容判断，重复执行不会插两遍） */
const PERMISSIONS = [
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
];
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
  return out;
}

/** MainApplication：注册 ReactPackage（幂等） */
function patchMainApplication(text) {
  if (text.includes("FocusTimerPackage()")) return text;
  return text.replace(
    /\/\/ Packages that cannot be autolinked yet can be added manually here, for example:[\s\S]*?\n(\s*)\}/,
    (m, indent) => m.replace(/(\n\s*)\}/, "$1  // 手写原生模块（不走 prebuild）：专注计时前台服务\n$1  add(FocusTimerPackage())\n" + indent + "}")
  );
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
