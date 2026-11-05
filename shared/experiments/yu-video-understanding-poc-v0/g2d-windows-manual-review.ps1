# YOUTOPIA G2-D local manual video/audio comparison support.
# Plan: create PRIVATE JSON outside Git based on existing G2-C authorized local original.
# Assess: read PRIVATE operator observations and print a redacted summary.
# NEVER downloads YouTube video/captions, uses a provider API, or changes project branches.
[CmdletBinding()]
param(
 [ValidateSet('Plan','Assess')]
 [string]$Mode='Plan',
 [ValidateSet('Sintel','TearsOfSteel')]
 [string]$Film='Sintel'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$node=Get-Command node -ErrorAction Stop
if ($Mode -eq 'Plan') { $probe=Get-Command ffprobe -ErrorAction Stop }
$localRoot=$env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($localRoot)) { throw 'G2D_FAIL_CLOSED: LOCALAPPDATA unavailable' }
$mediaRoot=Join-Path $localRoot 'YOUTOPIA\G2C-AuthorizedPublisherMedia'
$reviewRoot=Join-Path $localRoot 'YOUTOPIA\G2D-ManualReviews'
$nodeScript=Join-Path $PSScriptRoot 'g2d-human-review.cjs'
if (-not (Test-Path -LiteralPath $nodeScript -PathType Leaf)) { throw 'G2D_FAIL_CLOSED: missing Node reviewer' }
if ($Film -eq 'Sintel') {
 $filmDir='Sintel'
 $movie='Sintel.2010.720p.mkv'
 $subtitle='sintel_en.srt'
} else {
 $filmDir='TearsOfSteel'
 $movie='tears_of_steel_720p.mov'
 $subtitle='TOS-en.srt'
}
$review=Join-Path $reviewRoot ($Film+'-manual-review.json')
if ($Mode -eq 'Plan') {
 $media=Join-Path (Join-Path $mediaRoot $filmDir) $movie
 $srt=Join-Path (Join-Path $mediaRoot $filmDir) $subtitle
 if (-not (Test-Path -LiteralPath $media -PathType Leaf) -or -not (Test-Path -LiteralPath $srt -PathType Leaf)) {
   throw 'G2D_FAIL_CLOSED: existing G2-C authorized local film and SRT files required'
 }
 New-Item -ItemType Directory -Path $reviewRoot -Force | Out-Null
 if (Test-Path -LiteralPath $review) { throw 'G2D_FAIL_CLOSED: review packet exists; do not overwrite manual observations' }
 & $node.Source $nodeScript plan --film $Film --video $media --srt $srt --out $review
 if ($LASTEXITCODE -ne 0) { throw 'G2D_FAIL_CLOSED: local review plan generation failed' }
 Write-Host ('G2D_PRIVATE_REVIEW_FILE: '+$review)
 Write-Host 'Fill only verdict, observationNote, observedSpeechStartMs, observedYoutubeMs, observedYoutubeDurationMs and youtubeUploaderObservation. Keep raw dialogue and private identities out.'
 Write-Host 'Use the official YouTube watch page directly to compare visible scenes and audio. No video download needed.'
} else {
 if (-not (Test-Path -LiteralPath $review -PathType Leaf)) { throw 'G2D_FAIL_CLOSED: review JSON not found' }
 & $node.Source $nodeScript assess --review $review
 if ($LASTEXITCODE -ne 0) { throw 'G2D_FAIL_CLOSED: human review packet failed validation' }
}
