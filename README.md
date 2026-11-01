# Portfolio Jonas Bader

Persönliche Portfolio-Seite, entstanden im Modul Web Engineering (EWEB) an der BFH.

**Live:** https://jonasbader7.github.io/Portfoliopage/

## Aufbau

| Datei | Inhalt |
|-------|--------|
| `index.html` | Struktur und Inhalt: Header, Hero, Kernkompetenzen, Seitenleiste (`aside`), Über mich, Projekte, Kontakt, Footer |
| `styles.css` | Gestaltung: CSS-Variablen, Flexbox, Grid mit `grid-template-areas`, Media Queries (Mobile First) |
| `script.js` | Verhalten: Menü, Projektdetails aufklappen, BORS-Live-Vorschau, GitHub-API, Formularprüfung |
| `img/` | Bilder (Porträt, Projekt-Screenshots, Favicon) |

## Technologieentscheidungen

- **Nur HTML, CSS und JavaScript, ohne Framework.** Die Seite ist statisch und klein. Ein Framework wie React würde mehr Komplexität bringen, aber keinen Nutzen.
- **Mobile First.** Die Grundregeln gelten fürs Handy. Ab 768 px (Tablet) und 1024 px (Desktop) ergänzen Media Queries das Layout.
- **Details auf Klick.** Die Projektkarten zeigen zuerst nur das Wichtigste. Mehr Tiefe gibt es mit «Mehr erfahren», damit die Seite ruhig bleibt.
- **BORS-Vorschau erst auf Klick.** Die eingebettete BORS-App ist gross und wird deshalb erst geladen, wenn jemand sie öffnen will.
- **Daten per `fetch()`.** Die Seitenleiste lädt die neusten öffentlichen Repositories über die GitHub-API. Lade-, Leer- und Fehlerzustand werden angezeigt.
- **Sicherheit.** Text aus der GitHub-API wird mit `textContent` eingefügt, nie mit `innerHTML`.

## Deployment

GitHub Pages veröffentlicht den Branch `main` automatisch. Nach einem Push dauert es ein bis zwei Minuten, bis die Änderung live ist.

Eine GitHub Action (`.github/workflows/html-check.yml`) prüft bei jedem Push, ob `index.html` valides HTML ist.

## Lokal ansehen

Wegen `fetch()` die Seite über einen lokalen Server öffnen, nicht per Doppelklick:

```bash
python -m http.server 8000
```

Danach http://localhost:8000 im Browser öffnen.

## Bekannte Grenzen

- Das Kontaktformular prüft die Eingaben, verschickt aber keine E-Mails.
- Die GitHub-API erlaubt ohne Anmeldung nur eine begrenzte Zahl Abfragen pro Stunde. Ist das Limit erreicht, zeigt die Seitenleiste einen Hinweis statt der Liste.
