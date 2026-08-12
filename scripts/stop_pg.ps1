$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pgbin = Join-Path $root '.tools\pg\Library\bin'
$data  = Join-Path $root '.pgdata'
& (Join-Path $pgbin 'pg_ctl.exe') status -D $data 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'PostgreSQL 未在运行'; exit 0 }
& (Join-Path $pgbin 'pg_ctl.exe') stop -D $data -m fast -w
Write-Host 'PostgreSQL 已停止'
