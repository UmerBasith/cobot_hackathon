<#
  run_app.ps1 - start the round's backend (port 8000) and frontend (port 5173) in the background.
    powershell -ExecutionPolicy Bypass -File tools\run_app.ps1 -Round round1
  Logs: <round>\logs\api.log and web.log.  Stop with tools\stop_app.ps1
  Open: http://localhost:5173   (API docs: http://localhost:8000/docs)
#>
param([string]$Round = "round1")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot
$r = Join-Path $root $Round
if (-not (Test-Path "$r\frontend\package.json")) { throw "No app in $r. Run tools\new_round.ps1 -Round $Round first." }
New-Item -ItemType Directory -Force "$r\logs" | Out-Null

& (Join-Path $PSScriptRoot "stop_app.ps1") -Quiet

$py = Join-Path $root ".venv\Scripts\python.exe"
$apiLog = Join-Path $r "logs\api.log"
$webLog = Join-Path $r "logs\web.log"
# Start through cmd with file redirection (no inherited handles), so this script returns immediately.
$apiCmd = "`"`"$py`" -m uvicorn app.main:app --reload --reload-dir app --port 8000 --host 0.0.0.0 > `"$apiLog`" 2>&1`""
$webCmd = "`"npx vite --port 5173 --strictPort > `"$webLog`" 2>&1`""
Start-Process -FilePath "cmd.exe" -WorkingDirectory (Join-Path $r "backend") -WindowStyle Hidden -ArgumentList "/c $apiCmd"
Start-Process -FilePath "cmd.exe" -WorkingDirectory (Join-Path $r "frontend") -WindowStyle Hidden -ArgumentList "/c $webCmd"

$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 700
  try {
    $a = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8000/api/health
    $w = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:5173/
    if ($a.StatusCode -eq 200 -and $w.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
}
if ($ok) {
  Write-Output "OK  app running:  http://localhost:5173   (API docs http://localhost:8000/docs)"
} else {
  Write-Output "NOT READY after 40 s. Check logs:"
  Get-Content $apiLog -Tail 15 -ErrorAction SilentlyContinue
  Get-Content $webLog -Tail 10 -ErrorAction SilentlyContinue
  exit 1
}
