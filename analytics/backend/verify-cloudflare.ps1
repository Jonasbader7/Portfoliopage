#requires -Version 7.0
# End-to-end tests for deployed Jonas Analytics; no tokens or IPs shared by default.
param([switch]$ShowFullIp)
$ErrorActionPreference = 'Stop'
$directory = Join-Path $HOME '.jonas-analytics'
$urlPath = Join-Path $directory 'worker-url.txt'
$tokenPath = Join-Path $directory 'admin-token.xml'
if (!(Test-Path $urlPath)) { throw "Fehlende Worker-URL: $urlPath" }
if (!(Test-Path $tokenPath)) { throw "Fehlender Admin-Token: $tokenPath" }
$worker = (Get-Content -Raw $urlPath).Trim().TrimEnd('/')
if ($worker -notmatch '^https://[a-zA-Z0-9.-]+\.workers\.dev$') { throw "Ungueltige Worker-URL." }

Write-Host "1/5 Health-Check..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$worker/health" -Method Get
if ($health.ok -ne $true) { throw "Health-Check fehlgeschlagen." }
Write-Host "  Worker erreichbar" -ForegroundColor Green

Write-Host "2/5 Test-Seitenaufruf speichern..." -ForegroundColor Cyan
$headers = @{ Origin = 'https://jonasbader7.github.io' }
$page = @{site="portfolio";event="pageview";detail="";source="";device="desktop";browser="Other";duration=0} | ConvertTo-Json -Compress
$response = Invoke-WebRequest -Uri "$worker/collect" -Method Post -Headers $headers -Body $page -ContentType 'text/plain;charset=UTF-8'
if ($response.StatusCode -ne 204) { throw "Seitenaufruf HTTP-Status: $($response.StatusCode), erwartet 204." }
Write-Host "  Seitenaufruf gespeichert" -ForegroundColor Green

Write-Host "3/5 Test-Klick speichern..." -ForegroundColor Cyan
$click = @{site="portfolio";event="link_click";detail="github";source="";device="desktop";browser="Other";duration=0} | ConvertTo-Json -Compress
$response = Invoke-WebRequest -Uri "$worker/collect" -Method Post -Headers $headers -Body $click -ContentType 'text/plain;charset=UTF-8'
if ($response.StatusCode -ne 204) { throw "Klick HTTP-Status: $($response.StatusCode), erwartet 204." }
Write-Host "  Klick gespeichert" -ForegroundColor Green

Write-Host "4/5 Private Analytics abrufen..." -ForegroundColor Cyan
$secured = Import-Clixml -Path $tokenPath
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secured)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
try {
  $auth = @{ Authorization = "Bearer $plain" }
  $summary = Invoke-RestMethod -Uri "$worker/admin/summary?days=7" -Headers $auth -Method Get
  if ($null -eq $summary.totals) { throw "Ungueltige Summary-Antwort." }
  Write-Host "  Statistik abrufbar" -ForegroundColor Green
  $summary.totals | Format-Table -Property site,event,hits,seconds | Out-Host
  Write-Host "  Aggregierte Regionen (max. 8):"
  $summary.regions | Select-Object -First 8 | Format-Table -Property country,region,city,hits | Out-Host

  Write-Host "5/5 Getrennte Sicherheitslogs abrufen..." -ForegroundColor Cyan
  $security = Invoke-RestMethod -Uri "$worker/admin/security?limit=5" -Headers $auth -Method Get
  if ($null -eq $security.entries) { throw "Ungueltige Security-Antwort." }
  Write-Host "  IP-Protokolle geschuetzt abrufbar" -ForegroundColor Green
  foreach ($entry in $security.entries) {
    $ip = [string]$entry.ip
    if (!$ShowFullIp) {
      if ($ip -match '^\d+\.\d+\.\d+\.\d+$') { $ip = $ip -replace '\.\d+$', '.xxx' }
      elseif ($ip) { $ip = '[IPv6 verborgen]' }
    }
    Write-Host "  $($entry.ts)  $($entry.site)  $($entry.country)/$($entry.region)  $ip"
  }
} finally { Remove-Variable plain,auth -ErrorAction SilentlyContinue }
Write-Host "Alle Tests bestanden. Live-Tracking der Websites ist weiterhin deaktiviert." -ForegroundColor Green
Write-Host "Hinweis: Die zwei Testevents sind in der Datenbank enthalten."
