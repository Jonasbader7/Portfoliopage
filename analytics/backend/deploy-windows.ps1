<#
.SYNOPSIS
  Worker erneut bereitstellen (nach Aenderungen an src/worker.js).

.DESCRIPTION
  wrangler.jsonc enthaelt im Repo bewusst nur den Platzhalter fuer die D1 database_id.
  Dieses Skript holt die ID bei Cloudflare, schreibt eine Konfiguration NUR in den
  Temp-Ordner, deployt damit und loescht sie wieder. Im Repo aendert sich nichts.

.EXAMPLE
  cd "C:\Users\Bader\OneDrive\Desktop\Portfoliopage\analytics\backend"
  npm install
  powershell -ExecutionPolicy Bypass -File .\deploy-windows.ps1
#>
$ErrorActionPreference = 'Stop'
$backend = $PSScriptRoot
$wrangler = Join-Path $backend 'node_modules\.bin\wrangler.cmd'
if (-not (Test-Path $wrangler)) { throw "wrangler fehlt: zuerst 'npm install' in $backend ausfuehren." }

Write-Host '1/3 D1-Datenbank jonas-analytics bei Cloudflare suchen...' -ForegroundColor Cyan
$list = (& $wrangler d1 list --json | Out-String | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'wrangler d1 list fehlgeschlagen (Login? npx wrangler login).' }
$db = $list | Where-Object { $_.name -eq 'jonas-analytics' } | Select-Object -First 1
if (-not $db) { throw 'D1-Datenbank jonas-analytics nicht gefunden.' }
$databaseId = if ($db.uuid) { $db.uuid } else { $db.id }
if (-not $databaseId) { throw 'Die D1 database_id fehlt.' }

Write-Host '2/3 Temporaere Konfiguration erzeugen (ausserhalb des Repos)...' -ForegroundColor Cyan
$config = Get-Content -Raw (Join-Path $backend 'wrangler.jsonc') | ConvertFrom-Json
$config.d1_databases[0].database_id = "$databaseId"
$config.main = (Join-Path $backend 'src\worker.js')
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) 'jonas-analytics-deploy'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$tempConfig = Join-Path $tempDir 'wrangler.json'
[System.IO.File]::WriteAllText($tempConfig, ($config | ConvertTo-Json -Depth 20))

Write-Host '3/3 Worker bereitstellen...' -ForegroundColor Cyan
try {
  & $wrangler deploy --config $tempConfig
  if ($LASTEXITCODE -ne 0) { throw 'wrangler deploy fehlgeschlagen.' }
}
finally {
  Remove-Item $tempConfig -Force -ErrorAction SilentlyContinue
}
Write-Host 'Fertig. Pruefen: https://jonas-portfolio-analytics.jonas-bader-analytics.workers.dev/health' -ForegroundColor Green
