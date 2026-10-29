param(
  [string]$HostName = "57.128.201.254",
  [string]$SshUser = "root",
  [string]$RemoteWebRoot = "/var/www/ai-kreator.pl",
  [string]$RemoteSourcePath = "/opt/ai-kreator-source",
  [string]$IdentityFile = "",
  [int]$Port = 22,
  [switch]$RestartBackend,
  [switch]$ReloadNginx
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$frontendArchiveName = "ai-kreator-frontend.zip"
$frontendArchivePath = Join-Path $env:TEMP $frontendArchiveName
$sourceArchiveName = "ai-kreator-source.zip"
$sourceArchivePath = Join-Path $env:TEMP $sourceArchiveName
$remoteFrontendArchivePath = "/root/$frontendArchiveName"
$remoteSourceArchivePath = "/root/$sourceArchiveName"
$sshTarget = "$SshUser@$HostName"
$scpArgs = @()
$sshArgs = @()

if ($Port -gt 0) {
  $scpArgs += "-P"
  $scpArgs += $Port
  $sshArgs += "-p"
  $sshArgs += $Port
}

if ($IdentityFile) {
  $scpArgs += "-i"
  $scpArgs += $IdentityFile
  $sshArgs += "-i"
  $sshArgs += $IdentityFile
}

if (-not (Test-Path $distPath)) {
  throw "Brak folderu dist. Najpierw uruchom npm run build."
}

Write-Host "Tworze paczke frontendu z folderu dist..." -ForegroundColor Cyan
if (Test-Path $frontendArchivePath) {
  Remove-Item $frontendArchivePath -Force
}

tar -a -cf $frontendArchivePath -C $distPath .

Write-Host "Tworze paczke plikow backendu VPS..." -ForegroundColor Cyan
if (Test-Path $sourceArchivePath) {
  Remove-Item $sourceArchivePath -Force
}

tar -a -cf $sourceArchivePath `
  --exclude "vps/server/node_modules" `
  --exclude "vps/server/dist" `
  -C $projectRoot `
  vps `
  docs/VPS_MIGRATION_PLAN.md `
  docs/VPS_API_MAP.md `
  docs/VPS_SYNC_GUIDE.md

Write-Host "Wysylam frontend na VPS: $sshTarget" -ForegroundColor Cyan
scp @scpArgs $frontendArchivePath "${sshTarget}:$remoteFrontendArchivePath"

Write-Host "Wysylam pliki VPS/backend na serwer..." -ForegroundColor Cyan
scp @scpArgs $sourceArchivePath "${sshTarget}:$remoteSourceArchivePath"

$remoteCommands = @(
  "set -e",
  "mkdir -p '$RemoteWebRoot'",
  "mkdir -p '$RemoteSourcePath'",
  "apt-get update -y >/dev/null 2>&1 || true",
  "apt-get install -y unzip >/dev/null 2>&1 || true",
  "find '$RemoteWebRoot' -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +",
  "unzip -o '$remoteFrontendArchivePath' -d '$RemoteWebRoot' >/dev/null",
  "rm -f '$remoteFrontendArchivePath'",
  "unzip -o '$remoteSourceArchivePath' -d '$RemoteSourcePath' >/dev/null",
  "rm -f '$remoteSourceArchivePath'",
  "chown -R root:www-data '$RemoteWebRoot'",
  "find '$RemoteWebRoot' -type d -exec chmod 755 {} +",
  "find '$RemoteWebRoot' -type f -exec chmod 644 {} +",
  "chown -R root:root '$RemoteSourcePath'",
  "find '$RemoteSourcePath' -type d -exec chmod 755 {} +",
  "find '$RemoteSourcePath' -type f -exec chmod 644 {} +",
  "find '$RemoteSourcePath/vps/scripts' -type f -name '*.sh' -exec chmod 750 {} + 2>/dev/null || true",
  "chmod 600 '$RemoteSourcePath/vps/.env' 2>/dev/null || true",
  "chmod 600 '$RemoteSourcePath/vps'/.env.* 2>/dev/null || true"
)

if ($RestartBackend) {
  $remoteCommands += "if [ -f '$RemoteSourcePath/vps/docker-compose.yml' ]; then cd '$RemoteSourcePath/vps' && docker compose up -d --build; fi"
}

if ($ReloadNginx) {
  $remoteCommands += "systemctl reload nginx || true"
}

$remoteScript = $remoteCommands -join "; "

Write-Host "Rozpakowuje paczki na serwerze..." -ForegroundColor Cyan
ssh @sshArgs $sshTarget $remoteScript

Write-Host ""
Write-Host "Deploy zakonczony." -ForegroundColor Green
Write-Host "Frontend na VPS: $RemoteWebRoot" -ForegroundColor Green
Write-Host "Pliki VPS/backend: $RemoteSourcePath" -ForegroundColor Green
if ($RestartBackend) {
  Write-Host "Backend zostal przebudowany przez docker compose." -ForegroundColor Green
}
if ($ReloadNginx) {
  Write-Host "Nginx zostal przeladowany." -ForegroundColor Green
}
