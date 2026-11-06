# Export one isolated reviewer-only G2-F web bundle to a ZIP outside Git.
# Includes ONLY reviewer-specific question JSON + standalone local Node/HTML/CSS/JS.
# Excludes movie/SRT files, G2-E answers, other reviewer packets, keys, web deploy credentials.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidateSet('Sintel','TearsOfSteel')][string]$Film,
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Z0-9_-]{3,32}$')][string]$ReviewerCode,
 [string]$OutputDirectory=''
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'G2F_EXPORT_FAIL_CLOSED: LOCALAPPDATA missing'}
$node=Get-Command node -ErrorAction Stop
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
if([string]::IsNullOrWhiteSpace($OutputDirectory)){
 $OutputDirectory=Join-Path $env:LOCALAPPDATA 'YOUTOPIA\G2F-ReviewerExports'
}
$destination=[IO.Path]::GetFullPath($OutputDirectory)
if($destination.TrimEnd('\','/') -ieq $root.TrimEnd('\','/') -or
   $destination.StartsWith(($root.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)){
 throw 'G2F_EXPORT_FAIL_CLOSED: export output must be outside Git repository'
}
$packetDir=Join-Path $env:LOCALAPPDATA 'YOUTOPIA\G2F-IndependentReviews'
$packet=Join-Path $packetDir ($Film+'-'+$ReviewerCode+'-blind-review.json')
if(-not (Test-Path -LiteralPath $packet -PathType Leaf)){
 throw 'G2F_EXPORT_FAIL_CLOSED: per-reviewer question packet is missing'
}
$validator=Join-Path $PSScriptRoot 'g2f-blind-review.cjs'
& $node.Source $validator check --file $packet | Out-Null
if($LASTEXITCODE -ne 0){throw 'G2F_EXPORT_FAIL_CLOSED: invalid source review packet'}
# Ensure the exact packet identity is correct before any files are exported.
$meta=Get-Content -LiteralPath $packet -Raw -Encoding utf8 | ConvertFrom-Json
if($meta.film -cne $Film -or $meta.reviewerCode -cne $ReviewerCode){
 throw 'G2F_EXPORT_FAIL_CLOSED: packet identity does not match requested film and reviewer'
}
$baseName=$Film+'-'+$ReviewerCode+'-G2F-Reviewer-Web'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$zip=Join-Path $destination ($baseName+'.zip')
if(Test-Path -LiteralPath $zip){throw 'G2F_EXPORT_FAIL_CLOSED: existing ZIP will not be overwritten'}
$stage=Join-Path ([IO.Path]::GetTempPath()) ('G2F-export-'+[guid]::NewGuid().ToString('N'))
$bundle=Join-Path $stage $baseName
$codeDest=Join-Path $bundle 'app\shared\experiments\yu-video-understanding-poc-v0'
$privateDest=Join-Path $bundle 'private'
$mediaDest=Join-Path $bundle 'media'
$sourceFiles=@(
 'g2f-open-reviewer-workspace.ps1',
 'g2f-reviewer-workspace-server.cjs',
 'g2f-reviewer-workspace-client.js',
 'g2f-reviewer-workspace.html',
 'g2f-reviewer-workspace.css',
 'g2f-blind-review.cjs',
 'g2e-gold-pilot.cjs',
 'g2e-question-candidates.json',
 'g2d-human-review.cjs',
 'g2c-offline-verifier.cjs',
 'g2d-workspace-media.cjs'
)
try{
 foreach($folder in @($codeDest,$privateDest,$mediaDest)){New-Item -ItemType Directory -Path $folder -Force | Out-Null}
 foreach($file in $sourceFiles){
  $src=Join-Path $PSScriptRoot $file
  if(-not (Test-Path -LiteralPath $src -PathType Leaf)){throw 'G2F_EXPORT_FAIL_CLOSED: web component missing'}
  Copy-Item -LiteralPath $src -Destination (Join-Path $codeDest $file) -ErrorAction Stop
 }
 Copy-Item -LiteralPath $packet -Destination (Join-Path $privateDest (Split-Path -Leaf $packet)) -ErrorAction Stop
 $nameMovie=if($Film -eq 'Sintel'){'Sintel.2010.720p.mkv'}else{'tears_of_steel_720p.mov'}
 $nameSrt=if($Film -eq 'Sintel'){'sintel_en.srt'}else{'TOS-en.srt'}
 @(
  'G2-F 전용 웹 검수 패키지 — 검수자 '+$ReviewerCode+', 영화 '+$Film,
  '',
  '1. 본 ZIP을 검수자 개인 Windows PC에서 해제합니다.',
  '2. 권리가 허용되는 경우에 한해 검수자의 로컬 원본 영화와 SRT를 media 폴더에 별도 제공합니다.',
  '   이 ZIP에는 영화·SRT가 포함되지 않습니다.',
  '3. PowerShell에서 ZIP 해제 폴더로 이동하여 아래 명령을 실행합니다.',
  '   $launcher = ''.\app\shared\experiments\yu-video-understanding-poc-v0\g2f-open-reviewer-workspace.ps1''',
  ('   & $launcher -Film '+$Film+' -ReviewerCode '+$ReviewerCode+ ' -PacketPath ''.\private\'+$Film+'-'+$ReviewerCode+'-blind-review.json'' -VideoPath ''.\media\'+$nameMovie+''' -SubtitlePath ''.\media\'+$nameSrt+''''),
  '',
  '4. 표시된 G2F_REVIEWER_WORKSPACE_READY http://127.0.0.1:<port>/ 주소를 같은 PC 브라우저에서 엽니다.',
  '5. 실제 영상으로 6문항을 검토하여 저장합니다. 다른 검수자나 작성자 정답을 보지 않습니다.',
  '6. 완료 후 private 폴더의 본인 JSON 파일만 운영자에게 안전하게 반환합니다.',
  '',
  '주의: 이 웹은 중앙 호스팅 사이트가 아닌 검수자 PC 내부 127.0.0.1 로컬 전용입니다.',
  '이 ZIP/영상/정답을 공개 서버나 공개 Git 저장소에 업로드하지 마세요.'
 ) | Set-Content -LiteralPath (Join-Path $bundle 'README.txt') -Encoding utf8
 '사용 권한을 확인한 원본 영화와 SRT를 별도로 넣으세요. 아카이브에는 포함되지 않습니다.' |
   Set-Content -LiteralPath (Join-Path $mediaDest 'README.txt') -Encoding utf8
 Compress-Archive -LiteralPath $bundle -DestinationPath $zip -CompressionLevel Optimal -ErrorAction Stop
 Write-Host ('G2F_REVIEWER_WEB_PACKAGE_READY: '+$zip)
 Write-Host ('G2F_PACKAGE_SCOPE: '+$Film+' / '+$ReviewerCode)
 Write-Host 'Package contains 1 reviewer packet; no original film/SRT, no operator gold answers and no other reviewer packet.'
 Write-Host 'Deliver this individual package only to its intended reviewer. Original film media must be provided separately within permitted rights.'
}finally{
 if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force}
}
