# Live-Dashboard – automatische Datenanbindung

Das Dashboard lädt Statistiken direkt vom bestehenden Worker. Auf der öffentlichen Dashboard-Adresse wird die Live-Verfügbarkeit geprüft und anschliessend automatisch auf die geschützte Worker-Ansicht weitergeleitet. Dateiimport und PowerShell-Export sind nur noch optionale Offline-Funktionen.

**Live-Adresse nach Bereitstellung:** `https://jonas-portfolio-analytics.jonas-bader-analytics.workers.dev/dashboard`

- Einmal mit dem bestehenden Admin-Token anmelden; signierte Browseranmeldung für 24 Stunden.
- Der Admin-Token bleibt serverseitiges Geheimnis und wird nur beim Login per HTTPS übermittelt. Er wird nicht im HTML, in URLs oder im Local-/Session-Storage gespeichert.
- Die Anmeldung verwendet ein signiertes `Secure`, `HttpOnly`, `SameSite=Lax`-Cookie. Ändern des Admin-Tokens widerruft vorhandene Sitzungen. An- und Abmeldung erfordern einen POST von derselben Origin.
- Beim Öffnen und bei jedem Website-/Zeitraumwechsel werden Aggregate direkt abgefragt. Aktualisierung alle 60 Sekunden, solange der Tab sichtbar ist. Aufbewahrung und Datenerfassung bleiben unverändert.
- Die Auswertung reicht bis zur letzten vollen UTC-Stunde. Der Abruf ist aktuell; die laufende Teilstunde wird für vergleichbare Stundenperioden ausgeschlossen.
- Das Dashboard enthält keine IP-Sicherheitslogs. Statistiken und HTML-Antworten sind nicht öffentlich cachebar. Der bestehende Bearer-Zugang für lokale Skripte funktioniert weiter.

## Einmalige Bereitstellung

```powershell
cd analytics/backend
npm ci
powershell -ExecutionPolicy Bypass -File ./deploy-windows.ps1
```

Danach die Live-Adresse öffnen und anmelden. Der Deploy baut das eingebettete Dashboard automatisch aus `analytics/dashboard.html`. Direkter npm-Deploy baut es ebenfalls über `predeploy`. Wer die HTML-Datei manuell ändert, kann `npm run build:dashboard` ausführen; Tests erkennen einen veralteten eingebetteten Stand.

In der Cloud-Chat-Umgebung ist kein Cloudflare-Login vorhanden. Die öffentliche Seite zeigt bis zur Bereitstellung einen klaren Hinweis, statt Beispieldaten für echte Zahlen auszugeben.

## Prüfung

Node-Tests für signierte Sitzung, Ablauf, manipulierte Cookies, Token-Wechsel, Origin-Prüfung, geschützte API, Logout und Synchronität des HTML-Bundles. Browserprüfung mit SQLite-Testdaten: Anmeldung → automatischer Abruf → Serverfilter → erneutes Öffnen mit Sitzung → Abmeldung. Keine Testdaten wurden an den produktiven Collector gesendet.

---

# Grafisches Website-Dashboard – Ausbau 11.11.2026

Die Erweiterung umfasst Portfolio, **GreenRoute** (historischer Speicherschlüssel `bors`) und **Projekt Transparenz**. Der bisherige Datenbestand bleibt erhalten; keine Schemaänderung oder Datenmigration ist nötig.

## Optional: Offline-Bericht öffnen

Repository aktualisieren, dann in PowerShell 7:

```powershell
pwsh ./analytics/backend/dashboard-windows.ps1 -Days 30 -OpenDashboard
pwsh ./analytics/backend/dashboard-windows.ps1 -Days 7 -Site greenroute -OpenDashboard
pwsh ./analytics/backend/dashboard-windows.ps1 -Days 30 -Site transparenz -ExportJsonPath ./analytics-report.json
```

Der bestehende DPAPI-geschützte Token wird nur für die API-Abfrage benutzt. Der lokale HTML-Bericht enthält **nur Aggregate**, weder Token noch IP-Sicherheitslogs. Er wird in einem neuen temporären Ordner gespeichert. JSON-Berichte lassen sich auch über «Bericht laden» in `analytics/dashboard.html` öffnen. Diese Dateien enthalten private Statistiken: nicht ins öffentliche Repository committen. Beispieldaten sind deutlich als fiktiv gekennzeichnet.

## Was die Auswertung beantwortet

- Welche Website wird geöffnet? Aufrufe, Link-Klicks, Funktionsereignisse und aktive Sekunden pro Aufruf.
- Wie verändert sich die Nutzung? Gleich lange Vorperiode für Zeiträume bis 90 Tage; für längere Zeiträume keine irreführenden Prozentvergleiche ausserhalb der 180-Tage-Aufbewahrung.
- Was wird genutzt? Link-Kategorien, Projektdetails (nur Öffnen), GreenRoute-Vorschau, Sprachwechsel, Lesefortschritt und grobe Transparenz-Seitentypen.
- Woher kommt die Nutzung? Freigegebene UTM-/Referrer-Kategorien, Länder und ungefähre Regionen, Gerät und Browser.
- Wann? Tagesverlauf mit Nulltagen und UTC-Wochentag-/Stundenraster.
- Wie weiterarbeiten? JSON-Export und Tageswerte als CSV. Keine Besucher-, Sitzungs-, Funnel- oder Conversion-Behauptungen ohne entsprechende Kennungen.

Der Websitefilter gilt für alle Tabellen. Das Stundenraster benötigt einen entsprechend gefilterten API-Bericht; ein nachträglicher Websitefilter auf einem Gesamtbericht blendet es aus. Der Tageszoom betrifft nur Tagesverlauf und Tages-CSV, alle anderen Tabellen zeigen die gesamte geladene Periode. Neue Merkmale werden erst ab dem neuen Client gezählt und lassen sich historisch nicht rekonstruieren.

## Bereitstellung und Kompatibilität

Die Clients bleiben mit dem alten Worker kompatibel. Der grafische Bericht kann alte Summary-Antworten darstellen; Vorperioden, Stundenraster und saubere Websitefilter erfordern den **neuen Worker**. Ohne Worker-Update ignoriert der bisherige Server `site`; das Skript verweigert dann gefilterte Berichte, statt falsche Werte auszugeben.

Der Worker wird über den bestehenden lokalen Cloudflare-Login bereitgestellt:

```powershell
cd analytics/backend
npm ci
powershell -ExecutionPolicy Bypass -File ./deploy-windows.ps1
```

Die Cloud-Chat-Umgebung hat keinen Cloudflare-Login und keinen Admin-Token. Ein Live-Deployment und der Abruf deiner privaten Produktionsstatistiken müssen daher über die bestehende lokale Einrichtung erfolgen. GitHub Pages veröffentlicht die Clientdateien wie bisher nach dem Commit.

**Bestehende Abweichung korrigiert:** Im Worker stehen bereits 90 Tage für Sicherheitslogs, in der bisherigen Doku/Datenschutzseite fälschlich 14. Die Texte sind an das vorhandene Verhalten angepasst; Aufbewahrung und Sicherheitslog-Code wurden nicht verändert.

## Prüfungen

`cd analytics/backend; npm test` (Node >=22.13): echte SQLite-Abfragen, Zeitgrenzen/Vorperiode, Namensalias, Websitefilter, Authentifizierung, fehlerhafte Payloads, Datenschutzsignale und Client-Zeitmessung. Die Browserprüfung umfasst Filter, Leerzustand, sichere Textausgabe und mobiles Layout. Keine Testevents werden an den produktiven Collector gesendet.

---

# Analytics & Sicherheitsprotokolle – Bereitstellung

Status: **Aktiv seit 7. November 2026** (Pull Request #1, auf Portfolio und GreenRoute). Der Worker läuft unter `https://jonas-portfolio-analytics.jonas-bader-analytics.workers.dev`, `analytics-config.js` zeigt auf dessen `/collect`. Zähler und Sicherheitslog (volle IP-Adressen, 90 Tage) sind beide eingeschaltet; Jonas hat am 7.11.2026 entschieden, das so zu lassen. Ausschalten: in `analytics-config.js` beider Repos `endpoint: ""` setzen.

**Projekt Transparenz (vorbereitet 7.11.2026):** Der Worker akzeptiert zusätzlich `site: "transparenz"` (gleiche Erfassung inkl. Sicherheitslog, Entscheid Jonas). Bereitgestellt am 7.11.2026 (Version `da476383`).

**Worker erneut bereitstellen** (nach Änderungen an `src/worker.js`): in `analytics/backend` `npm install`, dann `powershell -ExecutionPolicy Bypass -File .\deploy-windows.ps1`. Ein direktes `npx wrangler deploy` scheitert, weil `wrangler.jsonc` im Repo nur den Platzhalter für die D1 `database_id` enthält; das Skript holt die ID bei Cloudflare und nutzt eine temporäre Konfiguration ausserhalb des Repos. Die Transparenz-Website bringt eigene Kopien von `analytics-config.js`/`analytics-client.js` mit (Repo `Projekt-Transparenz`, `src/transparenz/site/static/`); dort ausschalten mit `endpoint: ""` und `python -m transparenz build-site`. Deren Client zählt nur auf `https://jonasbader7.github.io` (Schutz gegen lokale Tests).

Auswerten: `pwsh analytics/backend/dashboard-windows.ps1` (Zähler der letzten 30 Tage), mit `-Days 7` oder `-Security` (zeigt IP-Adressen, vertraulich). Das Skript liest Worker-Adresse und Token aus `%USERPROFILE%\.jonas-analytics` (Token mit Windows DPAPI verschlüsselt, nie committen). Die Anleitung unten beschreibt die Ersteinrichtung, die schon erledigt ist.

**Eigene Besuche nicht zählen:** In jedem eigenen Browser (Laptop, Handy, Tablet) einmal `https://jonasbader7.github.io/Portfoliopage/?analytics=off` öffnen; ein Hinweis bestätigt es. Der Client speichert dann `jb-analytics-optout=1` im Local Storage von `jonasbader7.github.io` und sendet nichts mehr. Rückgängig mit `?analytics=on`. Der Merker gilt für den ganzen Host, wirkt aber nur in Clients, die ihn abfragen (GreenRoute- und Transparenz-Client brauchen dieselbe Prüfung). Bereits gezählte Besuche bleiben in der Statistik.

## Umfang

- Portfolio, GreenRoute und Projekt Transparenz: weltweite Seitenaufrufe, aggregierte Link-Kategorien, GreenRoute-Ansichts-/Tab-Nutzung und ungefähre aktive Nutzungsdauer (bei Transparenz ausschliesslich grobe Seitentypen, keine Fondskennungen)
- Weltweit: Land, Region und (sofern bestimmbar) ungefähre Stadt; für die Schweiz auch Kantone über die Geo-IP-Region
- Gerätetyp und Browser-Kategorie
- Separate technische Sicherheitsprotokolle mit IP-Adresse bei `pageview`, **nicht** mit Klickdetails verknüpft
- Kein Cookie-Banner, keine Cookies, kein Local Storage, keine individuellen Besuchskennungen, kein Fingerprinting, kein Tracking von Routen/Suchadressen/Formulareingaben
- GPC und DNT werden respektiert
- SQL-Aggregate: bis 180 Tage; Sicherheitslogs: max. 90 Tage (tägliche Cron-Löschung)
- Aussage: Die Zahlen sind **Aufrufe/Events, keine eindeutig identifizierten Personen**. Die Zeit ist nur eine Annäherung.

## Voraussetzung: Datenschutzprüfung

Diese Konfiguration verarbeitet vollständige IP-Adressen in einem getrennten, passwortgeschützten Sicherheitsprotokoll. Dies sind personenbezogene Daten. Eine fehlende Cookie-ID bedeutet **nicht automatisch**, dass alle Nutzungsanalysen ohne Einwilligung zulässig sind. Vor Inbetriebnahme Datenschutzhinweise und Erforderlichkeit/Rechtsgrundlage, EU-Besucher, Übermittlungen an Cloudflare sowie Sicherheitsmassnahmen prüfen; andernfalls nicht aktivieren.

Die öffentliche Datenschutzseite liegt unter `/analytics/datenschutz.html`.

## Cloudflare einrichten (manuelle Konto-Aktion erforderlich)

1. Kostenloses Cloudflare-Konto erstellen und Cloudflare Workers/D1 freischalten. GitHub Pages bleiben bestehen.
2. Lokal in `analytics/backend` wechseln, `npm install` und `npx wrangler login` ausführen.
3. Mit `npx wrangler d1 create jonas-analytics` die Datenbank erstellen und die zurückgegebene `database_id` in `wrangler.jsonc` eintragen.
4. Mit `npx wrangler d1 execute jonas-analytics --remote --file=./schema.sql` Tabellen anlegen.
5. Mit `npx wrangler secret put ADMIN_TOKEN` ein **zufälliges Passwort/Token mit mindestens 32 Zeichen** hinterlegen. Das Token ausschliesslich privat verwahren, nicht committen und nie in HTML/JavaScript schreiben.
6. Mit `npx wrangler deploy` den Worker bereitstellen. Die öffentliche Adresse ähnelt `https://jonas-portfolio-analytics.<account>.workers.dev`.
7. Den Worker mit `https://<worker-host>/health` testen. Die öffentliche URL des Tracking-Endpunkts ist `https://<worker-host>/collect`.
8. Nach Datenschutzprüfung und Prüfung des Worker-Betriebs auf **beiden** Webseiten die Datei `analytics-config.js` ändern: `endpoint: "https://<worker-host>/collect"`. Erst diese Änderung aktiviert die Datenerfassung beim Laden der Webseiten.

**Wichtig:** In `analytics-config.js` darf nie ein Admin-Token stehen.

## Berichte

Beispiele für die Verwendung im lokalen Terminal (Token nicht in Screenshots oder in einer öffentlich sichtbaren Shell-History veröffentlichen):

```bash
# WORKER_URL und ADMIN_TOKEN als lokale Umgebungsvariablen setzen.
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$WORKER_URL/admin/summary?days=30"
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$WORKER_URL/admin/security?limit=25"
```

Die `/admin/summary`-Antwort enthält `totals`, `countries`, `regions`, `devices`, `clicks`, `sources` und `daily`. Die `/admin/security`-Antwort enthält vollständige IP-Adressen und Zeitpunkte **nur** für den berechtigten Betreiber.

Für die Schweiz kann man im Feld `regions` nach `country === "CH"` filtern. Stadt/Kanton sind IP-basierte Näherungen, keine exakten Aufenthaltsorte.

Die API erfordert einen geheimen Bearer-Token. Empfehlenswert sind zusätzlich Cloudflare Access vor `/admin/*`, MFA und Beschränkung der Zugriffe. Sicherheitslogs nicht zu Marketingzwecken oder zur Zuordnung von Personennamen verwenden.

## Grenzen

- GitHub Pages liefert selbst keine rohen Server-IP-Logs an Repository-Betreiber. IP-Sicherheitsprotokolle bestehen nur für Anfragen, die **tatsächlich den Cloudflare-Worker erreichen**. Browserblocker, Offline-Nutzung, nicht aktiviertes Skript und DNT/GPC können die Messung verhindern.
- Das Security-Log ist daher **kein vollständiges GitHub-Pages-Access-Log** und keine geeignete alleinige Basis für Schutz gegen Angriffe auf GitHub Pages.
- Gezählt werden HTTP-Events; ohne Besuchercookies/IDs gibt es keine verlässliche Zahl einzelner Menschen.
- Stadt-/Region-Zuordnungen sind ungenau. Bei seltenen Orten können aggregierte Kleinfallzahlen Rückschlüsse ermöglichen; administrativen Zugriff einschränken.
- Keine automatischen Klicks auf dynamische GreenRoute-Daten, Suchadressen oder GPS-Positionen.
- Nicht als realer Sicherheitsservice, DDoS-Abwehr oder garantiert EU-konforme Rechtsberatung verstehen.

## Validierung vor Merge

1. Zuerst Worker und SQL-Schema in einer Testumgebung bereitstellen.
2. `/health` prüfen, Test-Event senden und über Admin-Endpunkt nur aggregierte Zähler sehen.
3. `security_access` prüfen: nur Pageviews, keine Klickdetails.
4. Löschen älterer Datensätze durch Cron testen.
5. Test mit aktivem Do Not Track / Global Privacy Control: keine Analytics-Anfragen.
6. Mobile/Desktop, Navigationslinks, Sprachen und GreenRoute-Routenberechnung smoke-testen.
7. Datenschutzseite in Portfolio und GreenRoute öffnen.
8. Erst danach Branches mergen und den echten Endpoint freigeben.

Der Dashboard-Endpunkt liefert JSON. Die grafische Oberfläche liegt in `analytics/dashboard.html`; echte Berichte werden ausschliesslich lokal geladen oder vom Windows-Skript eingebettet.
