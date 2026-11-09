<#
  screenshot.ps1 - take a PNG screenshot of a web page with headless Edge (or Chrome).
  Usage:
    powershell -ExecutionPolicy Bypass -File tools\screenshot.ps1 -Url http://localhost:5173/app -Out round1\deck\shots\dashboard.png
    (optional) -Width 1600 -Height 1000 -Dark -WaitMs 4000
  The app must be running (tools\run_app.ps1).
#>
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Width = 1600,
  [int]$Height = 1000,
  [int]$WaitMs = 4000,
  [switch]$Dark
)
$ErrorActionPreference = "Stop"
$browsers = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe"
)
$exe = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { throw "No Edge/Chrome found" }

$outFull = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Out))
New-Item -ItemType Directory -Force (Split-Path $outFull) | Out-Null
$prof = Join-Path $env:TEMP ("shot-profile-" + [guid]::NewGuid().ToString("N"))
$argv = @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--user-data-dir=$prof", "--window-size=$Width,$Height", "--virtual-time-budget=$WaitMs",
  "--force-device-scale-factor=1", "--screenshot=$outFull"
)
if ($Dark) { $Url = $Url + $(if ($Url.Contains("?")) { "&" } else { "?" }) + "theme=dark" }
$sep = if ($Url.Contains("?")) { "&" } else { "?" }
$argv += ($Url + $sep + "shot=1")
$p = Start-Process -FilePath $exe -ArgumentList $argv -PassThru -WindowStyle Hidden
if (-not $p.WaitForExit(60000)) { $p.Kill(); throw "Screenshot timed out" }
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
if (Test-Path $outFull) { Write-Output "OK  $outFull" } else { throw "Screenshot failed: $Url" }
