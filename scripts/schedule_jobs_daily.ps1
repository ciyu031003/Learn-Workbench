# 注册 Windows 任务计划：每天自动抓取招聘信息（招花）
# ⚠️ 2026-08-23 起：Python 爬虫 fetch_jobs.py 已废弃，生产环境由服务器 Node 爬虫负责（Docker/crontab）。
# 本脚本仅适用于本地开发库（需本地 PostgreSQL + Python 环境），不建议继续使用。
# 用法：以管理员身份运行  powershell -ExecutionPolicy Bypass -File scripts\schedule_jobs_daily.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = 'python'
$script = Join-Path $root 'scripts\fetch_jobs.py'
$workdir = $root
$taskName = 'ICT-LearnWorkbench-JobsCrawler'
$hour = 8
$minute = 0

$arg = '"' + $script + '" --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"'
$action = New-ScheduledTaskAction -Execute $python -Argument $arg -WorkingDirectory $workdir
$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($hour).AddMinutes($minute))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description '每天抓取各大招聘网站职位写入 Learn-Workbench.job_postings（按账号配置）' -Force
Write-Host "已注册任务：$taskName（每天 $hour:$minute）"
Write-Host '可用 Get-ScheduledTask -TaskName $taskName 查看；Start-ScheduledTask -TaskName $taskName 立即执行'
