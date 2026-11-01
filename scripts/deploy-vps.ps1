param(
  [string]$HostName = '57.128.201.254',
  [string]$SshUser = 'ubuntu',
  [string]$IdentityFile = "$env:USERPROFILE/.ssh/id_ed25519",
  [int]$Port = 22,
  [switch]$RestartBackend,
  [switch]$FrontendOnly
)
$ErrorActionPreference = 'Stop'
if ($RestartBackend -and $FrontendOnly) { throw 'Wybierz FrontendOnly albo RestartBackend.' }
if ($HostName -notmatch '^[A-Za-z0-9.-]+$' -or $SshUser -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'Niepoprawny adres lub użytkownik SSH.' }
if ($SshUser -notin @('ubuntu', 'deploy')) { throw 'Ta procedura obsługuje użytkownika ubuntu lub deploy.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  $npmCommand = if ($IsLinux -or $IsMacOS) { 'npm' } else { 'npm.cmd' }
  & $npmCommand test -- --maxWorkers=2
  if ($LASTEXITCODE -ne 0) { throw 'Testy strony nie przeszły.' }
  & $npmCommand run build
  if ($LASTEXITCODE -ne 0) { throw 'Budowanie strony nie powiodło się.' }
  if (-not $FrontendOnly) {
    & $npmCommand ci --prefix vps/server --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Instalacja zależności API nie powiodła się.' }
    & $npmCommand test --prefix vps/server
    if ($LASTEXITCODE -ne 0) { throw 'Testy API nie przeszły.' }
  }
  $packageResult = & node scripts/package-release.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Przygotowanie paczki nie powiodło się.' }
  $release = $packageResult | ConvertFrom-Json
  $sshTarget = "$SshUser@$HostName"
  $inbox = if ($SshUser -eq 'deploy') { 'incoming' } else { 'ai-kreator-incoming' }
  $sshOptions = @('-p', "$Port", '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $IdentityFile)
  $scpOptions = @('-P', "$Port", '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $IdentityFile)
  # umask protects the upload from its creation; no packages or secrets in /tmp.
  & ssh @sshOptions $sshTarget "umask 077; mkdir -p $inbox; chmod 700 $inbox"
  if ($LASTEXITCODE -ne 0) { throw 'Nie udało się przygotować prywatnego katalogu paczek.' }
  & scp @scpOptions $release.archive $release.checksum "${sshTarget}:$inbox/"
  if ($LASTEXITCODE -ne 0) { throw 'Przesyłanie paczki nie powiodło się.' }
  $remoteFiles = "$inbox/$($release.commit).tar.gz $inbox/$($release.commit).tar.gz.sha256"
  & ssh @sshOptions $sshTarget "chmod 600 $remoteFiles"
  if ($LASTEXITCODE -ne 0) { throw 'Nie udało się zabezpieczyć paczki.' }
  $releaseOption = if ($FrontendOnly) { ' --frontend-only' } elseif ($RestartBackend) { ' --rebuild-api' } else { '' }
  & ssh @sshOptions $sshTarget "sudo -n /usr/local/sbin/ai-kreator-deploy $($release.commit)$releaseOption"
  if ($LASTEXITCODE -ne 0) { throw 'Wdrożenie zgłosiło błąd. Sprawdź komunikat cofnięcia do poprzedniej wersji.' }
  $verification = Invoke-RestMethod -Uri "https://ai-kreator.pl/deployment-check.json?commit=$($release.commit)"
  if ($verification.commit -ne $release.commit -or $verification.status -ne 'verified') { throw 'Strona nie potwierdziła właściwej wersji.' }
  Remove-Item -LiteralPath $release.archive, $release.checksum
  Write-Host "Wdrożenie potwierdzone: $($release.commit)" -ForegroundColor Green
} finally { Pop-Location }
