# G2-F DEDICATED human reviewer-only browser. Run on the reviewer's own Windows PC.
# Never launches G2-D/G2-E author interface or exposes another reviewer answer.
# Offline-only after input files have been provided. No YouTube download / model API.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidateSet('Sintel','TearsOfSteel')][string]$Film,
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Z0-9_-]{3,32}$')][string]$ReviewerCode,
 [string]$PacketPath='',
 [string]$VideoPath='',
 [string]$SubtitlePath=''
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
 throw 'G2F_REVIEWER_WEB_FAIL_CLOSED: Windows LOCALAPPDATA is missing.'
}
$node=Get-Command node -ErrorAction Stop
Get-Command ffmpeg -ErrorAction Stop | Out-Null
$runner=Join-Path $PSScriptRoot 'g2f-reviewer-workspace-server.cjs'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
 throw 'G2F_REVIEWER_WEB_FAIL_CLOSED: reviewer-only web server module missing.'
}
$root=Join-Path $env:LOCALAPPDATA 'YOUTOPIA'
if ([string]::IsNullOrWhiteSpace($PacketPath)) {
 $PacketPath=Join-Path $root ('G2F-IndependentReviews\'+$Film+'-'+$ReviewerCode+'-blind-review.json')
}
if ([string]::IsNullOrWhiteSpace($VideoPath)) {
 $VideoPath=Join-Path $root ('G2C-AuthorizedPublisherMedia\'+$Film+'\'+$(if($Film -eq 'Sintel'){'Sintel.2010.720p.mkv'}else{'tears_of_steel_720p.mov'}))
}
if ([string]::IsNullOrWhiteSpace($SubtitlePath)) {
 $SubtitlePath=Join-Path $root ('G2C-AuthorizedPublisherMedia\'+$Film+'\'+$(if($Film -eq 'Sintel'){'sintel_en.srt'}else{'TOS-en.srt'}))
}
$PacketPath=[IO.Path]::GetFullPath($PacketPath)
$VideoPath=[IO.Path]::GetFullPath($VideoPath)
$SubtitlePath=[IO.Path]::GetFullPath($SubtitlePath)
foreach($entry in @(@{type='Review packet';value=$PacketPath},@{type='Local film';value=$VideoPath},@{type='Local SRT';value=$SubtitlePath})){
 if (-not (Test-Path -LiteralPath $entry.value -PathType Leaf)) {
  throw ('G2F_REVIEWER_WEB_FAIL_CLOSED: '+$entry.type+' missing. Only the individual review packet and authorized local film/SRT must be provided.')
 }
}
Write-Host ('G2F_REVIEWER_FILM: '+$Film)
Write-Host ('G2F_REVIEWER_ID: '+$ReviewerCode)
Write-Host 'Reviewer-only browser: does not load G2-E author gold answers or other reviewer packets.'
Write-Host 'Local FFmpeg may create an MP4 proxy and waveform cache under AppData.'
Write-Host 'Use the G2F_REVIEWER_WORKSPACE_READY address on THIS PC only. Ctrl+C exits.'
& $node.Source $runner --packet $PacketPath --movie $VideoPath --srt $SubtitlePath --reviewer $ReviewerCode
if($LASTEXITCODE -ne 0){throw 'G2F_REVIEWER_WEB_FAIL_CLOSED: reviewer-only web server stopped with an error.'}
