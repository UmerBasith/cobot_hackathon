<#
  check_setup.ps1 - 1-minute health check of the whole hackathon kit. Run it the morning of the event.
    powershell -ExecutionPolicy Bypass -File tools\check_setup.ps1
#>
$root = Split-Path $PSScriptRoot
Set-Location $root
$py = Join-Path $root ".venv\Scripts\python.exe"
$fail = 0
function Check($name, [scriptblock]$test) {
  try { $r = & $test; if ($r -eq $false) { throw "failed" }; Write-Output ("[ OK ] " + $name) }
  catch { Write-Output ("[FAIL] " + $name + "  -> " + $_.Exception.Message); $script:fail++ }
}

Check "Python venv + packages" { & $py -c "import fastapi, uvicorn, pandas, sklearn, pptx, docx, matplotlib, pymupdf, httpx" ; $LASTEXITCODE -eq 0 }
Check "Node + npm" { (node --version) -and (npm --version) }
Check "Git" { (git --version) -ne $null }
Check "PowerPoint installed" { Test-Path "C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE" }
Check "Word installed" { Test-Path "C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE" }
Check "Edge for screenshots" { Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }
foreach ($r in "round1", "round2") {
  Check "$r folder prepared (frontend node_modules)" { Test-Path "$root\$r\frontend\node_modules\vite" }
  Check "$r backend tests" { Push-Location "$root\$r\backend"; & $py -m pytest -q 2>&1 | Out-Null; $ok = ($LASTEXITCODE -eq 0); Pop-Location; $ok }
}
Check "Frontend type check (round1)" { Push-Location "$root\round1\frontend"; cmd /c "npm run check" 2>&1 | Out-Null; $ok = ($LASTEXITCODE -eq 0); Pop-Location; $ok }
Check "Deck builder" { & $py tools\make_deck.py tools\deck_example.json "$env:TEMP\hack_check.pptx" | Out-Null; $LASTEXITCODE -eq 0 }
Check "Report builder" { & $py tools\make_doc.py tools\report_example.md "$env:TEMP\hack_check.docx" | Out-Null; $LASTEXITCODE -eq 0 }
Check "Ports 5173/8000 free" { -not (Get-NetTCPConnection -LocalPort 5173, 8000 -State Listen -ErrorAction SilentlyContinue) }
Check "Internet (for research)" { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 https://www.google.com).StatusCode -eq 200 }

if ($fail -eq 0) { Write-Output "`nALL GOOD - ready for the hackathon." } else { Write-Output "`n$fail check(s) failed - ask Claude to fix them before the round." }
