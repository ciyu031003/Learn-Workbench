$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pgbin = Join-Path $root '.tools\pg\Library\bin'
$data  = Join-Path $root '.pgdata'
$log   = Join-Path $data 'server.log'
if (-not (Test-Path (Join-Path $pgbin 'pg_ctl.exe'))) { Write-Error '未找到 PostgreSQL，请先执行 conda create -p .tools/pg -c conda-forge postgresql -y'; exit 1 }
& (Join-Path $pgbin 'pg_ctl.exe') status -D $data 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Host 'PostgreSQL 已在运行 (127.0.0.1:5432)'; exit 0 }
& (Join-Path $pgbin 'pg_ctl.exe') start -D $data -l $log -o '-p 5432 -h 127.0.0.1' -w
if ($LASTEXITCODE -ne 0) { Write-Error 'PostgreSQL 启动失败，请查看 .pgdata\server.log'; exit 1 }
Write-Host 'PostgreSQL 已启动 (127.0.0.1:5432, 数据库 Learn-Workbench)'
