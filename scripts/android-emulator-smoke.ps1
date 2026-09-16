# =============================================================================
#  Android 模拟器跨品牌冒烟（标准 Android 行为回归）
#
#  用途：改动 targetSdk / 主题 / 清单 / 根布局之后，在「非 OPPO 的标准 Android」
#        上确认 App 仍能安装、启动、切换五个 Tab、滚动、开弹层 —— 即
#        「OPPO 适配不得影响其它品牌」这条硬约束的可执行证据（ColorOS 专项仍需云真机）。
#
#  前置：sdkmanager 装好 `emulator` 与对应 `system-images;android-<API>;google_apis;x86_64`
#        （脚本会在缺失时给出安装命令）
#
#  用法：
#    pwsh scripts/android-emulator-smoke.ps1 -Api 35 -Apk .local\accept\learn-workbench-v1.3.4.apk
#    pwsh scripts/android-emulator-smoke.ps1 -Api 36 -KeepRunning     # 保留截图与日志
#
#  产物：.local/emu-smoke/api<API>/*.png（启动 + 五个 Tab + 二级页）
# =============================================================================
param(
  [string]$Api = "35",
  [string]$Apk = "",
  [string]$AvdName = "",
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Apk) {
  $cand = Get-ChildItem (Join-Path $root ".local\accept") -Filter "learn-workbench-v*.apk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $cand) { throw "在 .local\accept 下找不到 APK，请用 -Apk 指定" }
  $Apk = $cand.FullName
}
$Apk = (Resolve-Path $Apk).Path
if (-not $AvdName) { $AvdName = "lwb-smoke-$Api" }

$outDir = Join-Path $root ".local\emu-smoke\api$Api"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Info($m) { Write-Host "[emu] $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "[emu][FAIL] $m" -ForegroundColor Red; exit 1 }

# ---------- 1) SDK 定位 ----------
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $null }
if (-not $sdk) { Fail "未设置 ANDROID_HOME / ANDROID_SDK_ROOT" }
$emulator = Join-Path $sdk "emulator\emulator.exe"
$adb = Join-Path $sdk "platform-tools\adb.exe"
$avdmanager = Get-ChildItem (Join-Path $sdk "cmdline-tools") -Recurse -Filter "avdmanager.bat" -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty FullName
if (-not (Test-Path $emulator)) { Fail "缺少 emulator：sdkmanager --install emulator" }
if (-not (Test-Path $adb)) { Fail "缺少 platform-tools/adb" }
if (-not $avdmanager) { Fail "缺少 avdmanager（cmdline-tools 未装全）" }

$image = "system-images;android-$Api;google_apis;x86_64"
$imageDir = Join-Path $sdk ("system-images\android-$Api\google_apis\x86_64")
if (-not (Test-Path $imageDir)) {
  Fail "缺少系统镜像 $image —— 先执行：sdkmanager --install `"$image`"（并 sdkmanager --licenses 接受许可）"
}
Info "SDK=$sdk  API=$Api  APK=$Apk"

# ---------- 2) AVD ----------
# 注意：手工解包安装的 emulator/镜像不会被 avdmanager 识别（它要求包已在 SDK 包列表中），
# 因此这里先看文件系统里有没有这个 AVD，有就直接用，避免误触发创建流程。
$avdHome = Join-Path $env:USERPROFILE ".android\avd"
$avdDir = Join-Path $avdHome "$AvdName.avd"
if (Test-Path $avdDir) {
  Info "复用已有 AVD 目录：$avdDir"
} else {
  $existing = (& $avdmanager list avd 2>&1 | Out-String)
  if ($existing -match [regex]::Escape("Name: $AvdName")) {
    Info "复用已有 AVD：$AvdName"
  } else {
    Info "创建 AVD：$AvdName（$image）"
    cmd /c "echo no| `"$avdmanager`" create avd -n `"$AvdName`" -k `"$image`" --force" | Out-Null
  }
}
if (-not (Test-Path $avdDir)) { Fail "AVD 不存在且创建失败：$avdDir" }

# ---------- 3) 启动模拟器 ----------
Info "启动模拟器（无窗口 / 软件渲染）"
$emuLog = Join-Path $outDir "emulator.log"
$emu = Start-Process -FilePath $emulator -PassThru -RedirectStandardOutput $emuLog -RedirectStandardError "$emuLog.err" `
  -ArgumentList @("-avd", $AvdName, "-no-window", "-no-audio", "-no-boot-anim", "-gpu", "swiftshader_indirect",
  "-no-snapshot-save", "-wipe-data", "-port", "5556")

try {
  Info "等待设备就绪（最长 5 分钟）"
  & $adb -s emulator-5556 wait-for-device | Out-Null
  $booted = $false
  for ($i = 0; $i -lt 60; $i++) {
    $b = (& $adb -s emulator-5556 shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    if ($b -eq "1") { $booted = $true; break }
    Start-Sleep -Seconds 5
  }
  if (-not $booted) { Fail "模拟器 5 分钟内未完成启动，日志：$emuLog" }
  Info "已启动：$(& $adb -s emulator-5556 shell getprop ro.build.version.release) (API $(& $adb -s emulator-5556 shell getprop ro.build.version.sdk))"

  function Shot($name) {
    $p = Join-Path $outDir "$name.png"
    cmd /c "`"$adb`" -s emulator-5556 exec-out screencap -p > `"$p`""
    Info "截图 → $p"
    return $p
  }

  # ---------- 4) 安装 + 启动 ----------
  Info "安装 APK"
  $install = (& $adb -s emulator-5556 install -r -d $Apk 2>&1 | Out-String)
  if ($install -notmatch "Success") { Fail "安装失败：$install" }
  Info "安装成功"

  $pkg = "com.yuanabd.learnworkbench"
  Info "启动 App"
  & $adb -s emulator-5556 shell am start -n "$pkg/.MainActivity" | Out-Null
  Start-Sleep -Seconds 12
  $pid1 = (& $adb -s emulator-5556 shell pidof $pkg 2>$null | Out-String).Trim()
  if (-not $pid1) { Fail "App 进程未起来（可能启动崩溃，看 $outDir\logcat.txt）" }
  & $adb -s emulator-5556 logcat -d > (Join-Path $outDir "logcat.txt") 2>$null
  Shot "01-launch" | Out-Null

  # ---------- 5) 五个 Tab + 滚动 + 弹层 ----------
  $size = (& $adb -s emulator-5556 shell wm size 2>$null | Out-String).Trim()   # 例：Physical size: 1080x2400
  $m = [regex]::Match($size, "(\d+)x(\d+)")
  if (-not $m.Success) { Fail "无法解析屏幕尺寸：$size" }
  $w = [int]$m.Groups[1].Value; $h = [int]$m.Groups[2].Value
  $tabY = [int]($h * 0.965)
  Info "屏幕 ${w}x${h}，Tab 行 y=$tabY"

  $tabs = @("today", "learn", "career", "wellness", "settings")
  for ($i = 0; $i -lt $tabs.Count; $i++) {
    $x = [int]($w * (($i + 0.5) / $tabs.Count))
    & $adb -s emulator-5556 shell input tap $x $tabY | Out-Null
    Start-Sleep -Seconds 3
    Shot ("0{0}-tab-{1}" -f ($i + 2), $tabs[$i]) | Out-Null
  }
  # 滚动
  & $adb -s emulator-5556 shell input swipe ([int]($w / 2)) ([int]($h * 0.7)) ([int]($w / 2)) ([int]($h * 0.3)) 400 | Out-Null
  Start-Sleep -Seconds 2
  Shot "07-scrolled" | Out-Null
  # 触摸链路自检（模拟器上一定能到达 JS；用于确认页面没有全屏覆盖层）
  Info "点击屏幕中央（验证触摸能到达 JS）"
  & $adb -s emulator-5556 shell input tap ([int]($w / 2)) ([int]($h * 0.45)) | Out-Null
  Start-Sleep -Seconds 2
  Shot "08-center-tap" | Out-Null

  # ---------- 6) 崩溃检查 ----------
  & $adb -s emulator-5556 logcat -d > (Join-Path $outDir "logcat-after.txt") 2>$null
  $log = Get-Content (Join-Path $outDir "logcat-after.txt") -Raw
  $fatal = ([regex]::Matches($log, "FATAL EXCEPTION")).Count
  $anr = ([regex]::Matches($log, "ANR in")).Count
  Info "FATAL EXCEPTION=$fatal  ANR=$anr"
  if ($fatal -gt 0) { Fail "出现 $fatal 次 FATAL EXCEPTION（见 $outDir\logcat-after.txt）" }

  Info "冒烟通过 ✅  产物目录：$outDir"
}
finally {
  if (-not $KeepRunning) {
    Info "关闭模拟器"
    & $adb -s emulator-5556 emu kill 2>$null | Out-Null
    Start-Sleep -Seconds 3
    if ($emu -and -not $emu.HasExited) { $emu.Kill() }
  } else {
    Info "已保留模拟器运行（emulator-5556），关闭：adb -s emulator-5556 emu kill"
  }
}
