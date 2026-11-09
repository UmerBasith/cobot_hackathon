<#
  stop_app.ps1 - stop whatever is serving the app ports (8000 backend, 5173 frontend, 4173 preview).
    powershell -ExecutionPolicy Bypass -File tools\stop_app.ps1
#>
param([switch]$Quiet)
foreach ($port in 8000, 5173, 4173) {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    if ($p -and $p -ne 0) {
      # uvicorn --reload runs a child; stop the parent tree too
      $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue).ParentProcessId
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
      if ($parent) {
        $pp = Get-Process -Id $parent -ErrorAction SilentlyContinue
        if ($pp -and ($pp.ProcessName -match "python|node|cmd")) { Stop-Process -Id $parent -Force -ErrorAction SilentlyContinue }
      }
      if (-not $Quiet) { Write-Output "stopped process $p on port $port" }
    }
  }
}
if (-not $Quiet) { Write-Output "OK  ports 8000/5173/4173 are free" }
