# 注册 Windows 任务计划：每天自动抓取 Bing 每日壁纸
# 用法：以管理员身份运行  powershell -ExecutionPolicy Bypass -File scripts\schedule_bing_daily.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = 'python'
$script = Join-Path $root 'scripts\fetch_bing_wallpaper.py'
$workdir = $root
$taskName = 'ICT-LearnWorkbench-BingWallpaper'
$hour = 8   # 每天 8:00 执行（可修改）
$minute = 0

$action = New-ScheduledTaskAction -Execute $python -Argument "`"$script`" --db `"host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres`"" -WorkingDirectory $workdir
$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($hour).AddMinutes($minute))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description '每天抓取 Bing 每日壁纸到 assets/backgrounds/bing 并写入 Learn-Workbench.background_images' -Force
Write-Host "已注册任务：$taskName（每天 $hour`:$minute）"
Write-Host '可用 Get-ScheduledTask -TaskName $taskName 查看；Start-ScheduledTask -TaskName $taskName 立即执行'
