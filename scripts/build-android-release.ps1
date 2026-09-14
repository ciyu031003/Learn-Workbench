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
  [string]$VersionName = "1.3.0",
  [int]$VersionCode = 9,
  [string]$Abis = "armeabi-v7a,arm64-v8a",
  [string]$ExpectedMd5 = "3057105285981cc18597a95c1370c147",
  [switch]$SkipVersionBump
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
const [gradleFile, appJson, pkgJson, vName, vCode] = process.argv.slice(2);
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
console.log("[build] 版本号已同步（gradle/app.json/package.json）");
'@
  $syncFile = Join-Path $env:TEMP "lwb-sync-version.cjs"
  Set-Content -Path $syncFile -Value $syncScript -Encoding UTF8
  & node $syncFile $gradleFile (Join-Path $mobile "app.json") (Join-Path $mobile "package.json") $VersionName $VersionCode
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
