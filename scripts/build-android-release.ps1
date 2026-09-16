# =============================================================================
# 一键构建 Android Release APK（把踩坑点 23 的隐性知识固化成脚本）
#
#   pwsh scripts/build-android-release.ps1 -VersionName 1.3.0 -VersionCode 9
#
# 设计要点：
#  1. 版本号唯一事实源 = android/app/build.gradle（与踩坑点 23 一致），脚本负责同步
#     app.json / package.json，避免三处漂移。
#  2. **不跑 `expo prebuild`**：prebuild 会重建 android/ 并把 release 签名重置为 debug（高危）。
#     新增 JS/原生依赖由 gradle autolinking 自动处理，无需 prebuild。
#     若确实需要 prebuild（改了 app.json 的图标/权限/插件），请先备份 keystore 再手动执行，
#     执行后按本脚本的 Assert-Signing 检查项逐条确认。
#  3. 构建后强制 apksigner 校验签名 MD5 —— 必须与备案一致，否则包装不上/备案失效。
# =============================================================================
param(
  [string]$VersionName = "1.3.1",
  [int]$VersionCode = 10,
  [string]$Abis = "armeabi-v7a,arm64-v8a",
  [string]$ExpectedMd5 = "3057105285981cc18597a95c1370c147",
  [switch]$SkipVersionBump,
  # R8/资源裁剪默认关闭：包体已达标（约 66MB），而 R8 只能在真机上验证是否破坏反射。
  # 需要更小包体时加 -EnableR8，并在真机回归通过后再考虑设为默认。
  [switch]$EnableR8
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root "apps\mobile"
$android = Join-Path $mobile "android"
$gradleFile = Join-Path $android "app\build.gradle"
$outDir = Join-Path $root ".local\accept"

function Info($m) { Write-Host "[build] $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "[build][FAIL] $m" -ForegroundColor Red; exit 1 }

# ---------- 1) 前置检查 ----------
Info "检查前置条件"
if (-not (Test-Path $gradleFile)) { Fail "找不到 $gradleFile（android/ 工程缺失）" }
foreach ($f in @("keystore\release.keystore", "keystore.properties")) {
  if (-not (Test-Path (Join-Path $android $f))) {
    $bak = Join-Path $root ".local\keystore-backup"
    if (-not (Test-Path $bak)) { Fail "缺少 $f 且没有备份目录 $bak —— 禁止在无签名的情况下打包" }
    Fail "缺少 android\$f；请先从 $bak 恢复（换签名会导致备案/微信登记全部失效）"
  }
}
if (-not $env:JAVA_HOME) { Fail "JAVA_HOME 未设置（需要 JDK 17+）" }
Info "JAVA_HOME = $env:JAVA_HOME"

# Gradle 工具链要求 languageVersion=17；若系统 JAVA_HOME 是 21/其它版本，Gradle 会尝试联网下载 JDK 17
# （本网络常被阻断 → 构建失败）。因此优先使用仓库内自带的 JDK 17。
$localJdk = Join-Path $root ".tools\jdk17\Library"
if (Test-Path (Join-Path $localJdk "bin\java.exe")) {
  $env:JAVA_HOME = $localJdk
  Info "改用仓库内 JDK 17：$localJdk"
}
Info "JAVA_HOME = $env:JAVA_HOME"

# ---------- 2) 版本号（单一事实源） ----------
# 注意：版本同步走 Node（utf8 安全）。禁止用 PowerShell Set-Content 改含中文的 app.json —— 会破坏多字节字符（看板踩坑点 40）
if (-not $SkipVersionBump) {
  Info "写入版本号到 build.gradle：versionName=$VersionName versionCode=$VersionCode"
  $syncScript = @'
const fs = require("fs");
const [gradleFile, appJson, pkgJson, otaFile, vName, vCode] = process.argv.slice(2);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let g = fs.readFileSync(gradleFile, "utf8");
g = g.replace(/versionCode\s+\d+/, `versionCode ${vCode}`);
g = g.replace(/versionName\s+"[^"]*"/, `versionName "${vName}"`);
fs.writeFileSync(gradleFile, g, "utf8");
for (const p of [appJson, pkgJson]) {
  let j = fs.readFileSync(p, "utf8");
  j = j.replace(/"version":\s*"[^"]*"/, `"version": "${vName}"`);
  if (p === appJson) j = j.replace(/"versionCode":\s*\d+/, `"versionCode": ${vCode}`);
  fs.writeFileSync(p, j, "utf8");
}
// lib/ota.ts 是「App 内展示的版本号」唯一来源，必须一起同步（否则关于页显示旧版本）
{
  let o = fs.readFileSync(otaFile, "utf8");
  o = o.replace(/APP_VERSION_NAME = "[^"]*"/, `APP_VERSION_NAME = "${vName}"`);
  o = o.replace(/APP_VERSION_CODE = \d+/, `APP_VERSION_CODE = ${vCode}`);
  fs.writeFileSync(otaFile, o, "utf8");
}
console.log("[build] 版本号已同步（gradle/app.json/package.json/ota.ts）");
'@
  $syncFile = Join-Path $env:TEMP "lwb-sync-version.cjs"
  Set-Content -Path $syncFile -Value $syncScript -Encoding UTF8
  & node $syncFile $gradleFile (Join-Path $mobile "app.json") (Join-Path $mobile "package.json") (Join-Path $mobile "src\lib\ota.ts") $VersionName $VersionCode
  if ($LASTEXITCODE -ne 0) { Fail "版本号同步失败" }
}

# ---------- 3) 签名配置断言（踩坑点 23 的三要素） ----------
Info "断言 build.gradle 签名配置"
$g = Get-Content $gradleFile -Raw
if ($g -notmatch "versionCode\s+$VersionCode") { Fail "build.gradle 的 versionCode 不等于 $VersionCode" }
if ($g -notmatch "versionName\s+`"$([regex]::Escape($VersionName))`"") { Fail "build.gradle 的 versionName 不等于 $VersionName" }
if ($g -notmatch "keystorePropertiesFile") { Fail "build.gradle 未加载 keystore.properties（release 签名会退化为 debug）" }
if ($g -notmatch "signingConfigs\s*\{[\s\S]*?release\s*\{") { Fail "build.gradle 缺少 signingConfigs.release 配置块" }
if ($g -notmatch "signingConfig keystorePropertiesFile\.exists\(\)") { Fail "release buildType 未引用正式签名（踩坑点 23）" }

# ---------- 3.5) 原生清单 / 资源 / 包体策略（APP v2 阶段 D + OPPO 兼容专项） ----------
# android/ 不进 git，prebuild 会重建它 —— 把「权限收敛 · 预测返回 · 经典系统栏 ·
# 关闭强制 edge-to-edge · 挖孔屏声明 · targetSdk 取向 · 启动图配色 · R8 开关」
# 固化成幂等修补，保证任何一次 prebuild 之后重新跑本脚本都能得到同样的合规包。
Info "修补原生清单与资源（权限收敛 / 经典系统栏 / targetSdk / 启动图配色）"
$nativePatch = @'
const fs = require("fs");
const path = require("path");
const [androidDir, canvasLight, canvasDark, enableR8] = process.argv.slice(2);
const log = [];

/** 确保主题里存在 <item name="X">V</item>：已存在则原位改值，否则插到第一个 </style> 之前 */
function ensureItem(xml, name, value) {
  const escaped = name.replace(/\./g, "\\.");
  const re = new RegExp(`(<item name="${escaped}">)[^<]*(</item>)`);
  if (re.test(xml)) return xml.replace(re, `$1${value}$2`);
  const idx = xml.indexOf("</style>");
  if (idx < 0) throw new Error(`styles.xml 缺少 </style>，无法插入 ${name}`);
  const head = xml.slice(0, idx).replace(/\s+$/, "");
  return `${head}\n    <item name="${name}">${value}</item>\n  ${xml.slice(idx)}`;
}

// 1) AndroidManifest
//    a) 移除悬浮窗权限（安装页会展示权限列表）
//    b) 关闭 Android 13+ 预测返回（enableOnBackInvokedCallback=false）：
//       RN/expo-router 在预测返回链路上实现不完整，回到经典返回是最稳的；
//       Android 15 起「不声明」的默认值本就是 false，这里显式钉死避免回退。
const manifestPath = path.join(androidDir, "app", "src", "main", "AndroidManifest.xml");
let m = fs.readFileSync(manifestPath, "utf8");
const m0 = m;
m = m.split("\n").filter((l) => !/SYSTEM_ALERT_WINDOW/.test(l)).join("\n");
m = m.replace(/android:enableOnBackInvokedCallback="[^"]*"/, 'android:enableOnBackInvokedCallback="false"');
if (m !== m0) { fs.writeFileSync(manifestPath, m, "utf8"); log.push("AndroidManifest 已修补"); }
else { log.push("AndroidManifest 无需修补"); }

// 2) 主题：经典系统栏策略（兼容优先，OPPO/ColorOS 触摸失效专项）
//    原来 statusBarColor/navigationBarColor = transparent，而窗口并未真 edge-to-edge
//    → 形成"伪 edge-to-edge"：窗口按系统栏内缩 + 各屏又加 insets.top，国产 ROM 上
//    最易出现 inset 错位/双重留白。这里改成唯一确定的事实：系统栏跟随画布色、窗口内缩。
const resDir = path.join(androidDir, "app", "src", "main", "res");
const stylesPath = path.join(resDir, "values", "styles.xml");
let s = fs.readFileSync(stylesPath, "utf8");
const s0 = s;
s = s.replace(/(<item name="android:statusBarColor">)[^<]*(<\/item>)/, "$1@color/app_bar_color$2");
s = s.replace(/(<item name="android:navigationBarColor">)[^<]*(<\/item>)/, "$1@color/app_bar_color$2");
// 系统栏图标明暗用 @bool 资源按日夜切换（避免复制整份 AppTheme）
s = ensureItem(s, "android:windowLightStatusBar", "@bool/system_bars_light");
s = ensureItem(s, "android:windowLightNavigationBar", "@bool/system_bars_light");
// Android 15 起 targetSdk 35+ 强制 edge-to-edge；显式 opt-out（仅 targetSdk 35 生效，见 gradle.properties）
s = ensureItem(s, "android:windowOptOutEdgeToEdgeEnforcement", "true");
// 挖孔屏：允许窗口延伸到挖孔区（真实安全区由 SafeAreaInsets 兜底）
s = ensureItem(s, "android:windowLayoutInDisplayCutoutMode", "shortEdges");
if (s !== s0) { fs.writeFileSync(stylesPath, s, "utf8"); log.push("styles.xml 已修补"); }
else { log.push("styles.xml 无需修补"); }

// 3) 颜色 / 布尔资源：浅色 = 品牌画布；深色走 values-night
const colorsPath = path.join(resDir, "values", "colors.xml");
let c = fs.readFileSync(colorsPath, "utf8");
const c0 = c;
c = c.replace(/(<color name="splashscreen_background">)[^<]*(<\/color>)/, `$1${canvasLight}$2`);
c = c.replace(/(<color name="iconBackground">)[^<]*(<\/color>)/, `$1${canvasLight}$2`);
if (/<color name="app_bar_color">/.test(c)) {
  c = c.replace(/(<color name="app_bar_color">)[^<]*(<\/color>)/, `$1${canvasLight}$2`);
} else {
  c = c.replace("</resources>", `  <color name="app_bar_color">${canvasLight}</color>\n</resources>`);
}
if (c !== c0) { fs.writeFileSync(colorsPath, c, "utf8"); log.push("colors.xml 已修补"); }
else { log.push("colors.xml 无需修补"); }

const nightDir = path.join(resDir, "values-night");
fs.mkdirSync(nightDir, { recursive: true });
const nightXml = `<resources>\n  <color name="splashscreen_background">${canvasDark}</color>\n  <color name="app_bar_color">${canvasDark}</color>\n</resources>\n`;
const nightPath = path.join(nightDir, "colors.xml");
if (fs.readFileSync(nightPath, "utf8") !== nightXml) {
  fs.writeFileSync(nightPath, nightXml, "utf8");
  log.push("values-night/colors.xml 已写入");
} else {
  log.push("values-night/colors.xml 已是最新");
}

const lightBools = `<resources>\n  <bool name="system_bars_light">true</bool>\n</resources>\n`;
const darkBools = `<resources>\n  <bool name="system_bars_light">false</bool>\n</resources>\n`;
const boolFiles = [
  [path.join(resDir, "values", "bools.xml"), lightBools],
  [path.join(nightDir, "bools.xml"), darkBools],
];
for (const [file, xml] of boolFiles) {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== xml) {
    fs.writeFileSync(file, xml, "utf8");
    log.push(`${path.relative(resDir, file)} 已写入`);
  }
}

// 4) gradle.properties：targetSdk 取向 + 关掉空开关 + R8 / 资源裁剪（默认关闭，包体已达标）
//    - android.targetSdkVersion：expo 根工程插件会把它写进 expoLibs 版本目录（RN 默认 36）。
//      兼容优先取 35：Android 15 起 35+ 强制 edge-to-edge，但 35 仍受
//      windowOptOutEdgeToEdgeEnforcement 管辖，36 起该开关被忽略。
//      商店门槛（OPPO/小米/vivo/华为 ≥30、Google Play 新应用 35）均满足；compileSdk 仍 36。
//    - edgeToEdgeEnabled：当前 RN 0.86 / Expo 57 组合下无任何代码读取（全量 grep 无命中），
//      显式置 false，避免将来某次升级后突然生效。
const propsPath = path.join(androidDir, "gradle.properties");
const want = enableR8 === "true";
const managed = {
  "android.targetSdkVersion": "35",
  "edgeToEdgeEnabled": "false",
  "android.enableProguardInReleaseBuilds": String(want),
  "android.enableShrinkResourcesInReleaseBuilds": String(want),
};
const managedKeys = Object.keys(managed);
let p = fs.readFileSync(propsPath, "utf8");
p = p.split("\n").filter((l) => !managedKeys.some((k) => l.startsWith(k + "="))).join("\n");
p = p.replace(/\n+$/, "\n");
p += managedKeys.map((k) => `${k}=${managed[k]}`).join("\n") + "\n";
fs.writeFileSync(propsPath, p, "utf8");
log.push(`targetSdk=35 · edgeToEdgeEnabled=false · R8/资源裁剪=${want}`);

console.log("[build] " + log.join(" · "));
'@
$patchFile = Join-Path $env:TEMP "lwb-patch-native.cjs"
Set-Content -Path $patchFile -Value $nativePatch -Encoding UTF8
$r8Flag = if ($EnableR8) { "true" } else { "false" }
& node $patchFile $android "#FDF8EF" "#171209" $r8Flag
if ($LASTEXITCODE -ne 0) { Fail "原生清单/资源修补失败" }

# 修补后断言（防止某次 prebuild 后静默回退）
$manifest = Get-Content (Join-Path $android "app\src\main\AndroidManifest.xml") -Raw
if ($manifest -match "SYSTEM_ALERT_WINDOW") { Fail "AndroidManifest 仍声明 SYSTEM_ALERT_WINDOW" }
if ($manifest -notmatch 'android:enableOnBackInvokedCallback="false"') { Fail "未关闭预测返回（enableOnBackInvokedCallback 应为 false）" }

$stylesXml = Get-Content (Join-Path $android "app\src\main\res\values\styles.xml") -Raw
if ($stylesXml -match 'android:statusBarColor">@android:color/transparent') { Fail "状态栏仍是透明（伪 edge-to-edge 未消除）" }
if ($stylesXml -notmatch '@color/app_bar_color') { Fail "系统栏未改为跟随画布色（app_bar_color）" }
if ($stylesXml -notmatch 'windowOptOutEdgeToEdgeEnforcement">true') { Fail "未声明 windowOptOutEdgeToEdgeEnforcement（Android 15 强制 edge-to-edge 未关闭）" }
if ($stylesXml -notmatch 'windowLayoutInDisplayCutoutMode">shortEdges') { Fail "未声明挖孔屏 shortEdges" }

$gradleProps = Get-Content (Join-Path $android "gradle.properties") -Raw
if ($gradleProps -notmatch "(?m)^android\.targetSdkVersion=35\r?$") { Fail "gradle.properties 未把 targetSdk 固定为 35" }
if ($gradleProps -notmatch "(?m)^edgeToEdgeEnabled=false\r?$") { Fail "edgeToEdgeEnabled 未置 false" }

$boolsXml = Get-Content (Join-Path $android "app\src\main\res\values\bools.xml") -Raw -ErrorAction SilentlyContinue
if ($boolsXml -notmatch 'name="system_bars_light">true') { Fail "缺少 values/bools.xml（系统栏图标明暗资源）" }
$boolsNight = Get-Content (Join-Path $android "app\src\main\res\values-night\bools.xml") -Raw -ErrorAction SilentlyContinue
if ($boolsNight -notmatch 'name="system_bars_light">false') { Fail "缺少 values-night/bools.xml（深色系统栏图标资源）" }

$splashColors = Get-Content (Join-Path $android "app\src\main\res\values\colors.xml") -Raw
if ($splashColors -match "#208AEF") { Fail "启动图配色仍是旧的 #208AEF" }

# ---------- 4) 构建 ----------
# 注意：gradle 把进度写在 stderr；在 $ErrorActionPreference='Stop' 下 PowerShell 5.1 会把
# native stderr 视为终止错误。这里改为「重定向到日志 + 只看退出码」，失败时打印日志尾部。
Info "开始 gradle assembleRelease（ABI: $Abis）—— 首次/增量构建可能数分钟到数十分钟"
$log = Join-Path $env:TEMP "lwb-gradle-build.log"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
Push-Location $android
try {
  & cmd /c ".\gradlew.bat assembleRelease `"-PreactNativeArchitectures=$Abis`" --console=plain > `"$log`" 2>&1"
  $gradleExit = $LASTEXITCODE
} finally {
  Pop-Location
  $ErrorActionPreference = $prevEap
}
if (Test-Path $log) { Get-Content $log -Tail 30 | ForEach-Object { Write-Host "  $_" } }
if ($gradleExit -ne 0) { Fail "gradlew assembleRelease 失败（exit $gradleExit），完整日志：$log" }

$apk = Join-Path $android "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) { Fail "未找到产物 $apk" }

# ---------- 5) 签名校验（MD5 必须与备案一致） ----------
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if (-not $sdk) { Fail "ANDROID_HOME 未设置，无法定位 apksigner" }
$apksigner = Get-ChildItem "$sdk\build-tools\*\apksigner.bat" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $apksigner) { Fail "找不到 apksigner.bat（build-tools 未安装？）" }

Info "校验签名（apksigner verify --print-certs）"
$prevEap2 = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$certs = (& cmd /c "`"$($apksigner.FullName)`" verify --print-certs `"$apk`" 2>&1" | Out-String)
$ErrorActionPreference = $prevEap2
$md5 = ([regex]::Match($certs, "certificate MD5 digest:\s*([0-9a-fA-F]{32})")).Groups[1].Value.ToLower()
if (-not $md5) { Info $certs; Fail "未能从 apksigner 输出解析 MD5" }
Info "签名 MD5 = $md5"
if ($md5 -ne $ExpectedMd5.ToLower()) {
  Fail "签名 MD5 与备案不一致（期望 $ExpectedMd5）—— 禁止发布该包；检查 keystore 是否被换过"
}

# ---------- 6) 产出 ----------
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$target = Join-Path $outDir "learn-workbench-v$VersionName.apk"
Copy-Item $apk $target -Force
$sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 1)
Info "产物：$target（$sizeMb MB）"
Info "versionName=$VersionName versionCode=$VersionCode abi=$Abis"
if ($sizeMb -gt 70) { Write-Host "[build][WARN] 包体 $sizeMb MB 超过 70MB 预算，检查是否打入了多 ABI 或死资源" -ForegroundColor Yellow }
Info "完成 ✅"
