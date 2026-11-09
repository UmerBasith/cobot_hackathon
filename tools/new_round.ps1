<#
  new_round.ps1 - make a fresh round folder from the kit (website + backend + deck/doc folders).
    powershell -ExecutionPolicy Bypass -File tools\new_round.ps1 -Round round1
    add -Force to wipe and recreate an existing round folder (asks nothing - be sure!).
    add -Sync to re-copy missing kit files into an existing round (keeps your work).
  Copies node_modules too, so it works OFFLINE (takes ~1 minute).
#>
param([Parameter(Mandatory = $true)][string]$Round, [switch]$Force, [switch]$Sync)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot
$r = Join-Path $root $Round
if ((Test-Path "$r\frontend") -and -not $Force -and -not $Sync) { Write-Output "EXISTS  $r (already prepared - nothing to do)"; exit 0 }
if ($Force -and (Test-Path $r)) { Remove-Item -Recurse -Force $r }
New-Item -ItemType Directory -Force $r, "$r\deck\shots", "$r\doc\img", "$r\deliver", "$r\logs", "$r\research" | Out-Null

# /XC /XN /XO = only copy files that are missing (never overwrite work in an existing round)
$only = if ($Sync) { @("/XC", "/XN", "/XO") } else { @() }
robocopy "$root\kit\frontend" "$r\frontend" /E /NFL /NDL /NJH /NJS /NP /XD "$root\kit\frontend\dist" @only | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy frontend failed ($LASTEXITCODE)" }
robocopy "$root\kit\backend" "$r\backend" /E /NFL /NDL /NJH /NJS /NP /XD "$root\kit\backend\data" "$root\kit\backend\.pytest_cache" __pycache__ @only | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy backend failed ($LASTEXITCODE)" }
New-Item -ItemType Directory -Force "$r\backend\data" | Out-Null
if (-not (Test-Path "$r\BRIEF.md")) { Copy-Item "$root\playbook\BRIEF_TEMPLATE.md" "$r\BRIEF.md" }
if (-not (Test-Path "$r\frontend\node_modules\vite\dist\node\cli.js")) { throw "node_modules incomplete in $r\frontend - run: cd $r\frontend; npm install" }
Write-Output "OK  $r ready: frontend (with node_modules), backend, deck\, doc\, deliver\, BRIEF.md"
