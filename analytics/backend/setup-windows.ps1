#requires -Version 7.0
<#
  Jonas Analytics / Cloudflare Worker - Windows setup.
  Runs locally in your own Cloudflare account.
  NO analytics is enabled on the public websites by this script.
  Admin token is encrypted with Windows DPAPI and never committed.
#>
param([switch]$SkipLogin)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$backend = $PSScriptRoot
Set-Location $backend
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "Node.js/npm fehlt. Installiere Node.js LTS von https://nodejs.org/ und starte PowerShell neu."
}
Write-Host "1/7 Wrangler installieren..." -ForegroundColor Cyan
& npm.cmd install --no-audit --no-fund
$wrangler = Join-Path $backend 'node_modules\.bin\wrangler.cmd'
if (-not (Test-Path $wrangler)) { throw "Wrangler wurde nicht installiert." }
if (-not $SkipLogin) {
  Write-Host "2/7 Cloudflare-Anmeldung im Browser..." -ForegroundColor Cyan
  & $wrangler login
}
$setupDir = Join-Path $HOME '.jonas-analytics'
New-Item -ItemType Directory -Force -Path $setupDir | Out-Null
$temp = Join-Path ([System.IO.Path]::GetTempPath()) 'jonas-analytics-cloudflare-init'
New-Item -ItemType Directory -Force -Path $temp | Out-Null
Push-Location $temp
try {
  Write-Host "3/7 Cloudflare D1-Datenbank pruefen..." -ForegroundColor Cyan
  $list = (& $wrangler d1 list --json | Out-String | ConvertFrom-Json)
  $db = $list | Where-Object { $_.name -eq 'jonas-analytics' } | Select-Object -First 1
  if (-not $db) {
    Write-Host "Neue Datenbank jonas-analytics erstellen (Western-Europe-Standorthinweis)..."
    & $wrangler d1 create jonas-analytics --location weur
    $list = (& $wrangler d1 list --json | Out-String | ConvertFrom-Json)
    $db = $list | Where-Object { $_.name -eq 'jonas-analytics' } | Select-Object -First 1
  }
  if (-not $db) { throw "D1-Datenbank konnte nicht gefunden werden." }
  $databaseId = if ($db.uuid) { $db.uuid } else { $db.id }
  if (-not $databaseId) { throw "Die D1 database_id fehlt." }
}
finally { Pop-Location }
$configPath = Join-Path $backend 'wrangler.jsonc'
$config = Get-Content -Raw $configPath | ConvertFrom-Json
$config.d1_databases[0].database_id = "$databaseId"
$config | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $configPath
Write-Host "4/7 Datenbankschema in Cloudflare anlegen..." -ForegroundColor Cyan
& $wrangler d1 execute jonas-analytics --remote --file=./schema.sql
Write-Host "5/7 Worker bereitstellen (Websites bleiben noch ohne Analytics)..." -ForegroundColor Cyan
$deploy = (& $wrangler deploy | Out-String)
Write-Host $deploy
$match = [regex]::Match($deploy, 'https://[a-zA-Z0-9.-]+\.workers\.dev')
if (-not $match.Success) {
  Write-Warning "Worker moeglicherweise bereitgestellt, URL wurde nicht erkannt."
  Write-Host "Cloudflare > Workers & Pages oeffnen und workers.dev-URL notieren."
} else {
  $workerUrl = $match.Value.TrimEnd('/')
  Set-Content -Path (Join-Path $setupDir 'worker-url.txt') -Value $workerUrl -Encoding utf8
}
Write-Host "6/7 Sicheren Administrator-Token lokal einrichten..." -ForegroundColor Cyan
$secretFile = Join-Path $setupDir 'admin-token.xml'
if (Test-Path $secretFile) {
  $secret = Import-Clixml -Path $secretFile
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
} else {
  $token = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  $secure = ConvertTo-SecureString -String $token -AsPlainText -Force
  $secure | Export-Clixml -Path $secretFile
}
$token | & $wrangler secret put ADMIN_TOKEN
Remove-Variable token -ErrorAction SilentlyContinue
Write-Host "7/7 Gesundheitspruefung..." -ForegroundColor Cyan
if ($workerUrl) {
  try {
    $health = Invoke-RestMethod -Uri "$workerUrl/health" -TimeoutSec 20
    Write-Host "Worker Health: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
    Write-Host "Worker-Adresse: $workerUrl" -ForegroundColor Green
  } catch { Write-Warning "Health-Check fehlgeschlagen: $($_.Exception.Message)" }
}
Write-Host "Fertig: Backend vorbereitet. Die oeffentlichen Websites erfassen NOCH NICHTS." -ForegroundColor Green
Write-Host "Token lokal verschluesselt gespeichert unter $secretFile."
Write-Host "Naechster Schritt: Worker testen, Datenschutzpruefung, danach Endpoint in beiden analytics-config.js-Dateien freigeben."
