# G2-C Blender publisher original media operator tool.
# In Plan mode: NO network, NO files, NO provider API.
# AcquireAndVerify only after explicit operator invocation, on an isolated Windows PC.
[CmdletBinding()]
param(
  [ValidateSet('Plan','AcquireAndVerify')]
  [string]$Mode = 'Plan',
  [ValidateSet('Sintel','TearsOfSteel')]
  [string]$Film = 'Sintel',
  [string]$OutputDirectory = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$inspector = Join-Path $PSScriptRoot 'g2c-offline-verifier.cjs'
if (-not (Test-Path -LiteralPath $inspector -PathType Leaf)) {
  throw 'G2C_OPERATOR_FAIL_CLOSED: missing offline inspector'
}
$specs = @{
  Sintel = @{
    slot = 'SYNTH-VID-05'
    mediaUrl = 'https://download.blender.org/durian/movies/Sintel.2010.720p.mkv.zip'
    mediaArchive = 'Sintel.2010.720p.mkv.zip'
    extractedName = 'Sintel.2010.720p.mkv'
    expectedPublisherArchiveBytes = 681285470
    subtitleUrl = 'https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt'
    subtitleName = 'sintel_en.srt'
    md5Url = 'https://download.blender.org/durian/movies/Sintel.2010.720p.mkv.md5'
  }
  TearsOfSteel = @{
    slot = 'SYNTH-VID-06'
    mediaUrl = 'https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov'
    mediaArchive = 'tears_of_steel_720p.mov'
    extractedName = 'tears_of_steel_720p.mov'
    expectedPublisherArchiveBytes = 372178639
    subtitleUrl = 'https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt'
    subtitleName = 'TOS-en.srt'
    md5Url = $null
  }
}
$spec = $specs[$Film]
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $OutputDirectory = Join-Path $env:LOCALAPPDATA 'YOUTOPIA\G2C-AuthorizedPublisherMedia'
  }
  else {
    $OutputDirectory = Join-Path $env:USERPROFILE 'YOUTOPIA-G2C-AuthorizedPublisherMedia'
  }
}
$dest = [IO.Path]::GetFullPath($OutputDirectory)
$repoPath = [IO.Path]::GetFullPath($root).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
if ($dest.StartsWith($repoPath, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'G2C_OPERATOR_FAIL_CLOSED: media destination must be outside Git repository'
}
if ($Mode -eq 'Plan') {
  [pscustomobject]@{
    stage = 'G2-C'
    mode = 'PLAN_ONLY'
    film = $Film
    slot = $spec.slot
    mediaUrl = $spec.mediaUrl
    publisherIndexBytes = $spec.expectedPublisherArchiveBytes
    subtitleUrl = $spec.subtitleUrl
    requiresLocalNode = $true
    requiresLocalFfprobe = $true
    actualDownloads = 0
    downloadsAuthorizedByPlan = $false
    rawMediaVerified = $false
    youtubeCompared = $false
    g3Authorized = $false
    actualProviderCalls = 0
    actualSpendUsd = 0
  } | ConvertTo-Json -Depth 5
  exit 0
}
# The explicit AcquireAndVerify mode never downloads anything from YouTube,
# never calls a model API, never edits Git and never writes media inside the repo.
$node = Get-Command node -ErrorAction Stop
$ffprobe = Get-Command ffprobe -ErrorAction Stop
$mediaDir = Join-Path $dest $Film
New-Item -ItemType Directory -Path $mediaDir -Force | Out-Null
$mediaDownloadedPath = Join-Path $mediaDir $spec.mediaArchive
$subtitlePath = Join-Path $mediaDir $spec.subtitleName
$videoPath = Join-Path $mediaDir $spec.extractedName
function Fetch-PublisherFile {
  param([string]$Url,[string]$Destination,[long]$MinBytes)
  if (Test-Path -LiteralPath $Destination) {
    $existing = Get-Item -LiteralPath $Destination -ErrorAction Stop
    if (-not $existing.PSIsContainer -and $existing.Length -ge $MinBytes) { return }
    throw 'G2C_OPERATOR_FAIL_CLOSED: existing file is truncated or invalid; review it manually'
  }
  $temporary = $Destination + '.partial-' + [guid]::NewGuid().ToString('N')
  try {
    Invoke-WebRequest -Uri $Url -OutFile $temporary -MaximumRedirection 5 -ErrorAction Stop
    $actual = (Get-Item -LiteralPath $temporary -ErrorAction Stop).Length
    if ($actual -lt $MinBytes) { throw 'G2C_OPERATOR_FAIL_CLOSED: publisher download smaller than expected minimum' }
    Move-Item -LiteralPath $temporary -Destination $Destination -ErrorAction Stop
  }
  finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  }
}
Fetch-PublisherFile -Url $spec.mediaUrl -Destination $mediaDownloadedPath -MinBytes ([long]($spec.expectedPublisherArchiveBytes * 0.9))
Fetch-PublisherFile -Url $spec.subtitleUrl -Destination $subtitlePath -MinBytes 100
$mediaIndexSizeMatches = ((Get-Item -LiteralPath $mediaDownloadedPath).Length -eq [long]$spec.expectedPublisherArchiveBytes)
$publisherMd5 = 'NOT_AVAILABLE'
if ($Film -eq 'Sintel') {
  if (-not (Test-Path -LiteralPath $videoPath)) {
    $unzipped = Join-Path $mediaDir 'Extracted-Sintel-Temporary'
    if (Test-Path -LiteralPath $unzipped) { throw 'G2C_OPERATOR_FAIL_CLOSED: previous extraction directory exists' }
    New-Item -ItemType Directory -Path $unzipped | Out-Null
    try {
      Expand-Archive -LiteralPath $mediaDownloadedPath -DestinationPath $unzipped -ErrorAction Stop
      $mkv = @(Get-ChildItem -LiteralPath $unzipped -File -Recurse -Filter 'Sintel.2010.720p.mkv')
      if ($mkv.Count -ne 1) { throw 'G2C_OPERATOR_FAIL_CLOSED: expected one Sintel 720p movie in archive' }
      Move-Item -LiteralPath $mkv[0].FullName -Destination $videoPath -ErrorAction Stop
    }
    finally {
      Remove-Item -LiteralPath $unzipped -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  # Publisher MD5 is useful for detecting accidental file mismatch, not a
  # security-grade signature or proof of rights or YouTube version equality.
  $md5File = Join-Path $mediaDir 'Sintel.2010.720p.mkv.md5'
  try {
    Fetch-PublisherFile -Url $spec.md5Url -Destination $md5File -MinBytes 32
    $match = [regex]::Match([IO.File]::ReadAllText($md5File),'(?i)\b[a-f0-9]{32}\b')
    if ($match.Success) {
      $localMd5 = (Get-FileHash -LiteralPath $videoPath -Algorithm MD5).Hash
      $publisherMd5 = if ($localMd5 -ieq $match.Value) { 'MATCHES_PUBLISHER_MD5' } else { 'MISMATCH_STOP' }
      if ($publisherMd5 -eq 'MISMATCH_STOP') { throw 'G2C_OPERATOR_FAIL_CLOSED: movie differs from Blender MD5' }
    }
  }
  catch {
    if ($publisherMd5 -eq 'MISMATCH_STOP') { throw }
    $publisherMd5 = 'PUBLISHER_CHECKSUM_UNAVAILABLE'
  }
}
$raw = & $node.Source $inspector --slot $spec.slot --video $videoPath --srt $subtitlePath
if ($LASTEXITCODE -ne 0) { throw 'G2C_OPERATOR_FAIL_CLOSED: offline file verifier failed' }
$inspected = (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
if ($inspected.g3Authorized -ne $false -or $inspected.providerCalls -ne 0 -or $inspected.status -ne 'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY') {
  throw 'G2C_OPERATOR_FAIL_CLOSED: result escaped required safety bounds'
}
[pscustomobject]@{
  stage = 'G2-C'
  mode = 'LOCAL_PUBLISHER_MEDIA_INSPECTED_NOT_SERVICE_APPROVED'
  film = $Film
  publisherMovieByteLengthMatchesIndex = $mediaIndexSizeMatches
  publisherMd5Evidence = $publisherMd5
  mediaSha256 = $inspected.video.sha256
  mediaByteSize = $inspected.video.byteSize
  actualDurationMs = $inspected.video.durationMs
  actualWidth = $inspected.video.width
  actualHeight = $inspected.video.height
  codec = $inspected.video.codec
  captionSha256 = $inspected.caption.sha256
  captionCueCount = $inspected.caption.cueCount
  captionFirstStartMs = $inspected.caption.firstStartMs
  captionLastEndMs = $inspected.caption.lastEndMs
  captionBounds = $inspected.caption.syntaxAndDurationBounds
  subtitlePublisherTimingStatus = $inspected.caption.publisherTimings.status
  youtubeVideoSameVersionVerified = $false
  actualSpokenCaptionAlignmentVerified = $false
  realDatasetApproved = $false
  g3Authorized = $false
  actualProviderCalls = 0
  actualSpendUsd = 0
} | ConvertTo-Json -Depth 6
