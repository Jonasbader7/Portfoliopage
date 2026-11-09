#requires -Version 7.0
# Jonas Analytics CLI dashboard, token never displayed.
param([ValidateRange(1,180)][int]$Days=30,[ValidateRange(1,100)][int]$Top=20,[switch]$Security,[ValidateRange(1,1000)][int]$SecurityLimit=1000,[string[]]$ExcludeIP=@(),[switch]$IncludeOwnIP)
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
  $data=Invoke-RestMethod -Uri "$worker/admin/summary?days=$Days" -Headers $headers
  Write-Host "JONAS ANALYTICS - $Days Tage" -ForegroundColor Cyan
  Write-Host 'Es handelt sich um Events, nicht eindeutige Menschen oder Sitzungen.'
  Write-Host 'WEBSITES' -ForegroundColor Yellow
  $data.totals | Format-Table site,event,hits,seconds -AutoSize | Out-Host
  Write-Host 'LAENDER' -ForegroundColor Yellow
  $data.countries | Select-Object -First $Top | Format-Table country,hits -AutoSize | Out-Host
  Write-Host 'SCHWEIZER KANTONE UND STAEDTE (ungefaehr)' -ForegroundColor Yellow
  $data.regions | Where-Object { $_.country -eq 'CH' } | Select-Object -First $Top | Format-Table region,city,hits -AutoSize | Out-Host
  Write-Host 'WELTWEITE REGIONEN (ausser CH)' -ForegroundColor Yellow
  $data.regions | Where-Object { $_.country -ne 'CH' } | Select-Object -First $Top | Format-Table country,region,city,hits -AutoSize | Out-Host
  Write-Host 'GERAETE UND BROWSER' -ForegroundColor Yellow
  $data.devices | Select-Object -First $Top | Format-Table device,browser,hits -AutoSize | Out-Host
  Write-Host 'KLICKS UND BORS-ANSICHTEN' -ForegroundColor Yellow
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

