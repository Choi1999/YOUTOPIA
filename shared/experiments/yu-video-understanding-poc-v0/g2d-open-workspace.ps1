# G2-D local waveform QA web workspace launcher. No download or remote server.
# Starts ONLY a 127.0.0.1 server and reads existing G2-C media / G2-D private review JSON.
[CmdletBinding()]
param(
 [ValidateSet('Sintel','TearsOfSteel')]
 [string]$Film='Sintel'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$node=Get-Command node -ErrorAction Stop
Get-Command ffmpeg -ErrorAction Stop | Out-Null
Get-Command ffprobe -ErrorAction Stop | Out-Null
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
 throw 'G2D_WORKSPACE_FAIL_CLOSED: local AppData path unavailable'
}
$privateRoot=Join-Path $env:LOCALAPPDATA 'YOUTOPIA\G2D-ManualReviews'
$review=Join-Path $privateRoot ($Film+'-manual-review.json')
if (-not (Test-Path -LiteralPath $review -PathType Leaf)) {
 throw 'G2D_WORKSPACE_FAIL_CLOSED: create local private G2-D review JSON first using g2d-windows-manual-review.ps1 -Mode Plan'
}
$script=Join-Path $PSScriptRoot 'g2d-workspace-server.cjs'
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
 throw 'G2D_WORKSPACE_FAIL_CLOSED: local server script missing'
}
Write-Host ('G2D_WORKSPACE_FILM: '+$Film)
Write-Host 'This command may generate a browser playback MP4 proxy and audio waveform once, stored ONLY under AppData.'
Write-Host 'Copy the G2D_LOCAL_WORKSPACE_READY URL into your browser. Press Ctrl+C here to stop the local workspace.'
& $node.Source $script --film $Film
if ($LASTEXITCODE -ne 0) { throw 'G2D_WORKSPACE_FAIL_CLOSED: local workspace exited abnormally' }
