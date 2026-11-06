# Analytics & Sicherheitsprotokolle – Bereitstellung

Status: **Vorbereitet, nicht aktiv.** Der Code ist in einem separaten GitHub-Branch. Die Datei `analytics-config.js` enthält absichtlich eine leere Endpoint-URL. Bis zur Einrichtung werden **keine Analytics-Anfragen** verschickt.

## Umfang

- Portfolio und BORS: weltweite Seitenaufrufe, aggregierte Link-Kategorien, BORS-Ansichts-/Tab-Nutzung und ungefähre aktive Nutzungsdauer
- Weltweit: Land, Region und (sofern bestimmbar) ungefähre Stadt; für die Schweiz auch Kantone über die Geo-IP-Region
- Gerätetyp und Browser-Kategorie
- Separate technische Sicherheitsprotokolle mit IP-Adresse bei `pageview`, **nicht** mit Klickdetails verknüpft
- Kein Cookie-Banner, keine Cookies, kein Local Storage, keine individuellen Besuchskennungen, kein Fingerprinting, kein Tracking von Routen/Suchadressen/Formulareingaben
- GPC und DNT werden respektiert
- SQL-Aggregate: bis 180 Tage; Sicherheitslogs: max. 14 Tage (tägliche Cron-Löschung)
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
- Keine automatischen Klicks auf dynamische BORS-Daten, Suchadressen oder GPS-Positionen.
- Nicht als realer Sicherheitsservice, DDoS-Abwehr oder garantiert EU-konforme Rechtsberatung verstehen.

## Validierung vor Merge

1. Zuerst Worker und SQL-Schema in einer Testumgebung bereitstellen.
2. `/health` prüfen, Test-Event senden und über Admin-Endpunkt nur aggregierte Zähler sehen.
3. `security_access` prüfen: nur Pageviews, keine Klickdetails.
4. Löschen älterer Datensätze durch Cron testen.
5. Test mit aktivem Do Not Track / Global Privacy Control: keine Analytics-Anfragen.
6. Mobile/Desktop, Navigationslinks, Sprachen und BORS-Routenberechnung smoke-testen.
7. Datenschutzseite in Portfolio und BORS öffnen.
8. Erst danach Branches mergen und den echten Endpoint freigeben.

Der Dashboard-Endpunkt liefert JSON; eine grafische Admin-Oberfläche ist nicht Bestandteil dieser ersten Version.
