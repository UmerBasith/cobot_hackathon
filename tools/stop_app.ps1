<#
  stop_app.ps1 - stop whatever is serving the app ports (8000 backend, 5173 frontend, 4173 preview),
  including uvicorn's reload worker and vite's cmd wrapper.
    powershell -ExecutionPolicy Bypass -File tools\stop_app.ps1
#>
param([switch]$Quiet)
$all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue

function Stop-Tree([int]$id) {
  foreach ($child in ($all | Where-Object { $_.ParentProcessId -eq $id })) { Stop-Tree $child.ProcessId }
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}

foreach ($port in 8000, 5173, 4173) {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    if (-not $p -or $p -eq 0) { continue }
    $proc = $all | Where-Object { $_.ProcessId -eq $p }
    # also stop the cmd.exe wrapper that run_app.ps1 started (parent), if it is ours
    if ($proc) {
      $parent = $all | Where-Object { $_.ProcessId -eq $proc.ParentProcessId -and $_.Name -match "^(cmd|python|node)\.exe$" }
      if ($parent) { Stop-Tree $parent.ProcessId }
    }
    Stop-Tree $p
    if (-not $Quiet) { Write-Output "stopped process tree $p on port $port" }
  }
}
Start-Sleep -Milliseconds 500
$left = Get-NetTCPConnection -LocalPort 8000, 5173, 4173 -State Listen -ErrorAction SilentlyContinue
if ($left -and -not $Quiet) { Write-Output "WARNING: still listening: $($left.LocalPort -join ', ')" }
elseif (-not $Quiet) { Write-Output "OK  ports 8000/5173/4173 are free" }
