<#
  export_office.ps1 - use the real PowerPoint / Word on this laptop to:
    * check the file opens without errors
    * save a PDF copy (backup if the judges' laptop has no PowerPoint)
    * PowerPoint: export every slide as PNG (so Claude can LOOK at the slides and fix layout)
              and count animations per slide (proves the animations loaded)
    * Word: report the page count (the doc must be 10 pages or less)

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\export_office.ps1 -File round1\deck\deck.pptx
    powershell -ExecutionPolicy Bypass -File tools\export_office.ps1 -File round1\doc\report.docx

  Safe: runs Office in a background job with a time limit and never closes Office
  windows the user already has open. If it times out, continue - the .pptx/.docx
  itself is fine; only the PDF/PNG copies are missing.
#>
param([Parameter(Mandatory = $true)][string]$File, [switch]$NoPng, [int]$TimeoutSec = 120)
$ErrorActionPreference = "Stop"
$full = (Resolve-Path $File).Path
$ext = [System.IO.Path]::GetExtension($full).ToLower()

$ppt = {
  param($full, $noPng)
  $dir = Split-Path $full
  $base = [System.IO.Path]::GetFileNameWithoutExtension($full)
  [string]$pdf = [System.IO.Path]::Combine($dir, "$base.pdf")
  $app = New-Object -ComObject PowerPoint.Application
  try { $app.DisplayAlerts = 1 } catch {}
  $hadOpen = $app.Presentations.Count
  try {
    $pres = $app.Presentations.Open([string]$full, -1, 0, 0)   # ReadOnly, not Untitled, no window
    $n = $pres.Slides.Count
    $pres.SaveAs([string]$pdf, 32)                              # ppSaveAsPDF
    if (-not $noPng) {
      $pngDir = Join-Path $dir "slides"
      if (Test-Path $pngDir) { Remove-Item -Recurse -Force $pngDir }
      New-Item -ItemType Directory $pngDir | Out-Null
      for ($i = 1; $i -le $n; $i++) { $pres.Slides.Item($i).Export((Join-Path $pngDir ("slide{0:D2}.png" -f $i)), "PNG", 1600, 900) }
    }
    $anim = @(); for ($i = 1; $i -le $n; $i++) { $anim += $pres.Slides.Item($i).TimeLine.MainSequence.Count }
    $pres.Close()
    "OK  PowerPoint opened $n slides"
    "    animations per slide: $($anim -join ', ')"
    "    PDF : $pdf"
    if (-not $noPng) { "    PNGs: $(Join-Path $dir 'slides')  <- look at these to check the layout" }
  } finally {
    if ($hadOpen -eq 0 -and $app.Presentations.Count -eq 0) { $app.Quit() }
  }
}

$word = {
  param($full)
  $dir = Split-Path $full
  $base = [System.IO.Path]::GetFileNameWithoutExtension($full)
  [string]$pdf = [System.IO.Path]::Combine($dir, "$base.pdf")
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0
  $hadOpen = $app.Documents.Count
  try {
    $doc = $app.Documents.Open([string]$full, $false, $true)    # ReadOnly
    $doc.Repaginate()
    $pages = $doc.ComputeStatistics(2)
    $words = $doc.ComputeStatistics(0)
    $doc.SaveAs2([string]$pdf, 17)                      # wdFormatPDF
    $doc.Close(0)
    "OK  Word opened the document"
    "    pages: $pages   words: $words"
    if ($pages -gt 10) { "    WARNING: more than 10 pages - shorten it" }
    "    PDF : $pdf"
  } finally {
    if ($hadOpen -eq 0 -and $app.Documents.Count -eq 0) { $app.Quit() }
  }
}

$procName = if ($ext -eq ".pptx") { "POWERPNT" } else { "WINWORD" }
$before = @(Get-Process $procName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$started = Get-Date
if ($ext -eq ".pptx") { $job = Start-Job -ScriptBlock $ppt -ArgumentList $full, ([bool]$NoPng) }
elseif ($ext -eq ".docx") { $job = Start-Job -ScriptBlock $word -ArgumentList $full }
else { throw "Use a .pptx or .docx file" }

if (Wait-Job $job -Timeout $TimeoutSec) {
  Receive-Job $job
  if ($job.State -eq "Failed") { Write-Output "FAILED: $($job.ChildJobs[0].JobStateInfo.Reason.Message)"; exit 1 }
  Remove-Job $job -Force
} else {
  Write-Output "TIMEOUT after $TimeoutSec s - Office got stuck. The file itself is saved; open it by hand to check."
  # Clean up ONLY the hidden Office copy this script started (never the user's windows).
  Get-Process $procName -ErrorAction SilentlyContinue |
    Where-Object { $before -notcontains $_.Id -and -not $_.MainWindowTitle -and $_.StartTime -ge $started.AddSeconds(-2) } |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  exit 2
}
