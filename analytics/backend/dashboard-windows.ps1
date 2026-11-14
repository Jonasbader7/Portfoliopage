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
  # The API groups every list by website. For the console, rows that differ only by
  # website are summed, otherwise the same country/device/source appears several times.
  function Merge-Hits([object[]]$Rows,[string[]]$Keys){
    @($Rows) | Where-Object { $_ } | Group-Object -Property $Keys | ForEach-Object {
      $row=[ordered]@{}
      foreach($k in $Keys){ $row[$k]=$_.Group[0].$k }
      $row.hits=[int64]($_.Group | Measure-Object hits -Sum).Sum
      [pscustomobject]$row
    } | Sort-Object hits -Descending
  }
  function Get-Hits($Rows,[string]$SiteName,[string]$EventName,[string]$Field='hits'){
    $sum=(@($Rows) | Where-Object { $_.site -eq $SiteName -and $_.event -eq $EventName } | Measure-Object $Field -Sum).Sum
    if($sum){[int64]$sum}else{0}
  }
  # PowerShell 7 turns ISO timestamps from JSON into DateTime values; accept both forms.
  function ConvertTo-Utc($Value){
    if($Value -is [datetime]){ if($Value.Kind -eq 'Local'){$Value.ToUniversalTime()}else{[datetime]::SpecifyKind($Value,'Utc')} }
    else{ [datetimeoffset]::Parse([string]$Value,[cultureinfo]::InvariantCulture).UtcDateTime }
  }
  $sinceUtc=ConvertTo-Utc $data.since
  $untilUtc=ConvertTo-Utc $data.until
  $siteNames=@('portfolio','greenroute','transparenz') | Where-Object { $Site -eq 'all' -or $_ -eq $Site }

  Write-Host "Zeitraum: $($sinceUtc.ToLocalTime().ToString('yyyy-MM-dd HH:mm')) bis $($untilUtc.ToLocalTime().ToString('yyyy-MM-dd HH:mm')) (lokale Zeit, laufende Stunde nicht enthalten)"
  Write-Host 'WEBSITES' -ForegroundColor Yellow
  $siteNames | ForEach-Object {
    $views=Get-Hits $data.totals $_ 'pageview'
    $previous=Get-Hits $data.previous $_ 'pageview'
    $engaged=Get-Hits $data.totals $_ 'engagement'
    $seconds=Get-Hits $data.totals $_ 'engagement' 'seconds'
    [pscustomobject]@{
      Website=$_
      Aufrufe=$views
      Vorperiode=$previous
      Linkklicks=Get-Hits $data.totals $_ 'link_click'
      Funktionen=Get-Hits $data.totals $_ 'feature_click'
      'Schnitt Sek.'=if($engaged){[int64][math]::Round($seconds/$engaged)}else{0}
    }
  } | Format-Table -AutoSize | Out-Host

  Write-Host 'LAENDER (Seitenaufrufe)' -ForegroundColor Yellow
  Merge-Hits $data.countries 'country' | Select-Object -First $Top | Format-Table country,hits -AutoSize | Out-Host
  $regions=Merge-Hits $data.regions 'country','region','city'
  Write-Host 'SCHWEIZER KANTONE UND STAEDTE (ungefaehr)' -ForegroundColor Yellow
  $regions | Where-Object { $_.country -eq 'CH' } | Select-Object -First $Top | Format-Table region,city,hits -AutoSize | Out-Host
  Write-Host 'WELTWEITE REGIONEN (ausser CH)' -ForegroundColor Yellow
  $regions | Where-Object { $_.country -ne 'CH' } | Select-Object -First $Top | Format-Table country,region,city,hits -AutoSize | Out-Host
  Write-Host 'GERAETE UND BROWSER' -ForegroundColor Yellow
  Merge-Hits $data.devices 'device','browser' | Select-Object -First $Top | Format-Table device,browser,hits -AutoSize | Out-Host
  Write-Host 'KLICKS UND FUNKTIONEN' -ForegroundColor Yellow
  $data.clicks | Sort-Object hits -Descending | Select-Object -First $Top | Format-Table site,event,detail,hits -AutoSize | Out-Host
  Write-Host 'HERKUNFT' -ForegroundColor Yellow
  Merge-Hits $data.sources 'source' | ForEach-Object {
    if(-not $_.source){$_.source='(direkt / unbekannt)'}; $_
  } | Select-Object -First $Top | Format-Table source,hits -AutoSize | Out-Host

  Write-Host 'TAGESVERLAUF (Seitenaufrufe, neueste zuerst)' -ForegroundColor Yellow
  $until=$untilUtc.Date
  $shownDays=[math]::Min($Days,60)
  $dayRows=for($i=0;$i -lt $shownDays;$i++){
    $day=$until.AddDays(-$i)
    if($day -eq $until -and $untilUtc -eq $until){ $shownDays++; continue } # 'until' is exclusive
    $key=$day.ToString('yyyy-MM-dd')
    $row=[ordered]@{ Tag=$key }
    $sum=0
    foreach($s in $siteNames){
      $n=(@($data.daily) | Where-Object { $_.day -eq $key -and $_.site -eq $s -and $_.event -eq 'pageview' } | Measure-Object hits -Sum).Sum
      $n=if($n){[int64]$n}else{0}
      $row[$s]=$n; $sum+=$n
    }
    if($siteNames.Count -gt 1){ $row.Total=$sum }
    [pscustomobject]$row
  }
  $dayRows | Format-Table -AutoSize | Out-Host
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
    $logs.entries | Where-Object { $Site -eq 'all' -or (($_.site -replace '^bors$','greenroute') -eq $Site) } | ForEach-Object {
      $time=ConvertTo-Utc $_.ts
      [pscustomobject]@{
        Zeit=$time.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss')
        Website=$_.site -replace '^bors$','greenroute'   # historical storage key
        IP=$_.ip; Land=$_.country; Region=$_.region; Stadt=$_.city
      }
    } | Format-Table -AutoSize | Out-Host
    $ownNote=if($IncludeOwnIP){'inklusive eigener IP'}else{'eigene aktuelle IP ausgeblendet'}
    Write-Host "($ownNote; die Statistik oben enthaelt eigene Besuche weiterhin, da sie anonym gezaehlt wird.)"
  }
  Write-Host 'Fertig.' -ForegroundColor Green
}finally{Remove-Variable token,headers -ErrorAction SilentlyContinue}

