#requires -Version 7.0
# Jonas Analytics CLI dashboard, token never displayed.
param([ValidateRange(1,180)][int]$Days=30,[ValidateRange(1,100)][int]$Top=20,[switch]$Security,[ValidateRange(1,1000)][int]$SecurityLimit=1000,[string[]]$ExcludeIP=@(),[switch]$IncludeOwnIP,[ValidateSet("all","portfolio","greenroute","transparenz")][string]$Site="all",[switch]$OpenDashboard,[string]$ExportJsonPath="")
$ErrorActionPreference='Stop'
$dir=Join-Path $HOME '.jonas-analytics'
$worker=(Get-Content -Raw (Join-Path $dir 'worker-url.txt')).Trim().TrimEnd('/')
if($worker -notmatch '^https://[a-zA-Z0-9.-]+[.]workers[.]dev$'){throw 'Invalid Worker URL'}
$secret=Import-Clixml -Path (Join-Path $dir 'admin-token.xml')
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try{$token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
try{
  $headers=@{ Authorization="Bearer $token" }
  $data=Invoke-RestMethod -Uri "$worker/admin/summary?days=$Days&site=$Site" -Headers $headers
  if($Site -ne "all" -and $data.site -ne $Site){throw "Der Worker unterstuetzt den Websitefilter noch nicht. Zuerst deploy-windows.ps1 ausfuehren."}
  Write-Host "JONAS ANALYTICS - $Days Tage" -ForegroundColor Cyan
  Write-Host 'Es handelt sich um Events, nicht eindeutige Menschen oder Sitzungen.'
  if($OpenDashboard -or $ExportJsonPath){
    # Aggregates only. No token, headers or security entries are exported.
    $reportJson=$data | ConvertTo-Json -Depth 20
    if($ExportJsonPath){
      [System.IO.File]::WriteAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ExportJsonPath),$reportJson)
      Write-Host "JSON-Bericht: $ExportJsonPath"
    }
    if($OpenDashboard){
      $template=Get-Content -Raw (Join-Path $PSScriptRoot '..\dashboard.html')
      $safeJson=$reportJson.Replace('&','\u0026').Replace('<','\u003c').Replace('>','\u003e')
      $html=$template.Replace('<script id="report-data" type="application/json">null</script>', '<script id="report-data" type="application/json">'+$safeJson+'</script>')
      $reportDir=Join-Path ([System.IO.Path]::GetTempPath()) ('jonas-analytics-'+[guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $reportDir | Out-Null
      $reportPath=Join-Path $reportDir 'report.html'
      [System.IO.File]::WriteAllText($reportPath,$html)
      Start-Process $reportPath
      Write-Host "Privater Bericht (lokale Statistikdaten): $reportPath"
    }
  }
  Write-Host 'WEBSITES'  -ForegroundColor Yellow
  $data.totals | Format-Table site,event,hits,seconds -AutoSize | Out-Host
  Write-Host 'LAENDER' -ForegroundColor Yellow
  $data.countries | Select-Object -First $Top | Format-Table country,hits -AutoSize | Out-Host
  Write-Host 'SCHWEIZER KANTONE UND STAEDTE (ungefaehr)' -ForegroundColor Yellow
  $data.regions | Where-Object { $_.country -eq 'CH' } | Select-Object -First $Top | Format-Table region,city,hits -AutoSize | Out-Host
  Write-Host 'WELTWEITE REGIONEN (ausser CH)' -ForegroundColor Yellow
  $data.regions | Where-Object { $_.country -ne 'CH' } | Select-Object -First $Top | Format-Table country,region,city,hits -AutoSize | Out-Host
  Write-Host 'GERAETE UND BROWSER' -ForegroundColor Yellow
  $data.devices | Select-Object -First $Top | Format-Table device,browser,hits -AutoSize | Out-Host
  Write-Host 'KLICKS UND FUNKTIONEN (GREENROUTE / TRANSPARENZ)' -ForegroundColor Yellow
  $data.clicks | Select-Object -First $Top | Format-Table site,event,detail,hits -AutoSize | Out-Host
  Write-Host 'HERKUNFT' -ForegroundColor Yellow
  $data.sources | Select-Object -First $Top | Format-Table source,hits -AutoSize | Out-Host
  Write-Host 'TAGESVERLAUF' -ForegroundColor Yellow
  $data.daily | Select-Object -First $Top | Format-Table day,site,event,hits -AutoSize | Out-Host
  if($Security){
    Write-Warning 'VERTRAULICH: Vollstaendige IP-Adressen. Ausgabe nicht weitergeben.'
    $excluded=@($ExcludeIP)
    if(-not $IncludeOwnIP){
      $self=Invoke-RestMethod -Uri "$worker/admin/ip" -Headers $headers
      if(-not $self.ip){throw 'Eigene IP konnte nicht ermittelt werden.'}
      $excluded += $self.ip
    }
    $query="limit=$SecurityLimit&days=$Days"
    foreach($address in $excluded){$query += "&excludeIP=$([Uri]::EscapeDataString($address))"}
    $logs=Invoke-RestMethod -Uri "$worker/admin/security?$query" -Headers $headers
    Write-Host "IP-Logs: letzte $Days Tage, maximal $SecurityLimit Eintraege; Aufbewahrung: $($logs.retentionDays) Tage."
    $logs.entries | Format-Table ts,site,ip,country,region,city,reason -AutoSize | Out-Host
  }
  Write-Host 'Fertig.' -ForegroundColor Green
}finally{Remove-Variable token,headers -ErrorAction SilentlyContinue}

