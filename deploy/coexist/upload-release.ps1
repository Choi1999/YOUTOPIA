# Windows PowerShell 5.1 / PowerShell7. Review after checking the outer ZIP hash.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Server,
    [Parameter(Mandatory=$true)][string]$ExpectedHost,
    [Parameter(Mandatory=$true)][string]$KeyFile,
    [Parameter(Mandatory=$true)][string]$KnownHostsFile,
    [Parameter(Mandatory=$true)][string]$BundleRoot
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
foreach ($value in @($Server,$ExpectedHost)) {
    if ($value -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*$') { throw 'Approved hostname or IPv4 required; no shell syntax is accepted.' }
}
foreach ($tool in @('ssh','scp','ssh-keygen')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing OpenSSH tool: $tool" }
}
$KeyFile=(Resolve-Path -LiteralPath $KeyFile).Path
$KnownHostsFile=(Resolve-Path -LiteralPath $KnownHostsFile).Path
$BundleRoot=(Resolve-Path -LiteralPath $BundleRoot).Path
$metadata=Get-Content -LiteralPath (Join-Path $BundleRoot 'delivery.json') -Raw | ConvertFrom-Json
if ($metadata.schema_version -ne 1 -or $metadata.source_sha -notmatch '^[0-9a-f]{40}$') { throw 'Invalid delivery metadata' }
$SourceSha=$metadata.source_sha
$expected=@{}
foreach ($property in $metadata.artifacts.PSObject.Properties) { $expected[$property.Name]=$property.Value }
$names=@("release-$SourceSha.tar.gz","operator-tools-$SourceSha.tar.gz")
if ($expected.Count -ne 2) { throw 'Exactly the reviewed application and tools archives are required' }
foreach ($name in $names) {
    if (-not $expected.ContainsKey($name) -or $expected[$name] -notmatch '^[0-9a-f]{64}$') { throw 'Invalid artifact name or digest' }
    $path=Join-Path (Join-Path $BundleRoot 'artifacts') $name
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected[$name]) { throw "Artifact hash mismatch: $name" }
}
# Existing independently verified trust only; no key generation or keyscan trust.
$trust=@(& ssh-keygen -F $Server -f $KnownHostsFile 2>$null)
if ($LASTEXITCODE -ne 0 -or @($trust | Where-Object { $_ -match '^\S+\s+ssh-ed25519\s+' }).Count -eq 0) {
    throw 'Existing verified ed25519 known_hosts entry required'
}
$knownOption='UserKnownHostsFile="'+$KnownHostsFile.Replace('\','/')+'"'
$options=@('-F','NUL','-i',$KeyFile,'-o','BatchMode=yes','-o','IdentitiesOnly=yes',
    '-o','StrictHostKeyChecking=yes','-o',$knownOption,'-o','GlobalKnownHostsFile=NUL','-o','UpdateHostKeys=no',
    '-o','HostKeyAlgorithms=ssh-ed25519','-o','PreferredAuthentications=publickey',
    '-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ForwardAgent=no','-o','ConnectTimeout=15')
$batch='release-'+$SourceSha
$prepare=@'
set -eu
test "$(id -un)" = youtopia-deploy
test "$(hostname -s)" = __EXPECTED_HOST__
case " $(id -nG) " in *" sudo "*|*" docker "*) echo 'Unexpected privileged group; stop' >&2; exit 1;; esac
test -d "$HOME/incoming" && test ! -L "$HOME/incoming"
destination="$HOME/incoming/__BATCH__"
test ! -e "$destination" && test ! -L "$destination"
mkdir -m 700 "$destination"
'@
$prepare=$prepare.Replace('__EXPECTED_HOST__',$ExpectedHost).Replace('__BATCH__',$batch).Replace("`r",'')
& ssh @options -T "youtopia-deploy@$Server" $prepare
if ($LASTEXITCODE -ne 0) { throw 'Account/host/upload-directory check failed; preserve existing preparation' }
$artifacts=Join-Path $BundleRoot 'artifacts'
$sums=Join-Path $artifacts 'UPLOAD_SHA256SUMS.txt'
$content=($names | ForEach-Object { $expected[$_]+'  '+$_ }) -join "`n"
[IO.File]::WriteAllText($sums,$content+"`n",(New-Object System.Text.UTF8Encoding($false)))
& scp @options (Join-Path $artifacts $names[0]) (Join-Path $artifacts $names[1]) $sums "youtopia-deploy@${Server}:incoming/$batch/"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed; no root action was run' }
$verify='set -eu; cd "$HOME/incoming/'+$batch+'"; sha256sum --check --strict UPLOAD_SHA256SUMS.txt'
& ssh @options -T "youtopia-deploy@$Server" $verify
if ($LASTEXITCODE -ne 0) { throw 'Server upload hashes differ; do not stage or activate' }
Write-Host "UPLOAD_VERIFIED source=$SourceSha; no privileged operation performed"
