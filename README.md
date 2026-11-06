# Portfolio Jonas Bader

Persönliche Portfolio-Seite, entstanden im Modul Web Engineering (EWEB) an der BFH.

**Live:** https://jonasbader7.github.io/Portfoliopage/

## Aufbau

| Datei | Inhalt |
|-------|--------|
| `index.html` | Struktur und Inhalt: Header, Hero, Seitenleiste (`aside`), Über mich, Projekte, Kontakt, Footer |
| `styles.css` | Gestaltung: Design-Tokens als CSS-Variablen (hell und dunkel), Flexbox, Grid mit `grid-template-areas`, Media Queries (Mobile First) |
| `script.js` | Verhalten: Sprachwechsel, Menü, Projektdetails aufklappen, BORS-Live-Vorschau, GitHub-API, Formular, Lesefortschritt, aktiver Menüpunkt, Einblenden beim Scrollen |
| `lang/en.json`, `lang/fr.json` | Übersetzungen ins Englische und Französische (Deutsch steht direkt im HTML) |
| `fonts/` | Schriften Inter, Inter Tight und JetBrains Mono als variable WOFF2-Dateien (Lizenz in `fonts/LIZENZ.md`) |
| `img/` | Bilder (Porträt, Projekt-Screenshots, Favicon) |

## Gestaltung

- **Typografie trägt das Design.** Grosse, eng gesetzte Titel in Inter Tight, Fliesstext in Inter, kleine Etiketten (Rolle, Projektart, Tags, Abschnittsnummern) in JetBrains Mono. Die Abschnittsnummern «01», «02» … entstehen per CSS-Zähler.
- **Eine Akzentfarbe.** Warmer Papierton, dunkle «Tinte» und Petrol als einzige Akzentfarbe. Alle Farben stehen als Tokens in `:root`; der dunkle Modus folgt der Geräteeinstellung (`prefers-color-scheme`) und tauscht nur die Tokens.
- **Spürbare Interaktionen.** Knöpfe geben beim Klicken nach, Pfeile rücken beim Überfahren nach, das Plus beim Aufklappen dreht sich zum ×, Karten heben sich leicht an (nur mit Maus, `@media (hover: hover)`). Wer weniger Bewegung eingestellt hat (`prefers-reduced-motion`), bekommt keine Animationen.
- **Schriften selbst ausgeliefert.** Keine Anfrage an Google Fonts; das ist schneller und gibt keine Daten an Dritte weiter. Die zwei wichtigsten Schriften werden mit `<link rel="preload">` früh geladen.

## Technologieentscheidungen

- **Nur HTML, CSS und JavaScript, ohne Framework.** Die Seite ist statisch und klein. Ein Framework wie React würde mehr Komplexität bringen, aber keinen Nutzen.
- **Mobile First.** Die Grundregeln gelten fürs Handy. Ab 768 px (Tablet) und 1024 px (Desktop) ergänzen Media Queries das Layout.
- **Details auf Klick.** Die Projektkarten zeigen zuerst nur das Wichtigste. Mehr Tiefe gibt es mit «Mehr erfahren», damit die Seite ruhig bleibt.
- **BORS-Vorschau erst auf Klick.** Die eingebettete BORS-App ist gross und wird deshalb erst geladen, wenn jemand sie öffnen will.
- **Daten per `fetch()`.** Die Seitenleiste lädt die neusten öffentlichen Repositories über die GitHub-API. Lade-, Leer- und Fehlerzustand werden angezeigt.
- **Drei Sprachen.** Elemente mit `data-i18n` erhalten beim Sprachwechsel den Text aus `lang/*.json`, die per `fetch()` geladen wird. Die gewählte Sprache wird im Browser gespeichert.
- **Kontaktformular über Web3Forms.** Eine statische Seite kann keine E-Mails verschicken. Das Formular sendet die Eingaben deshalb per `fetch()` an Web3Forms, das sie per E-Mail weiterleitet. Der Zugangsschlüssel darf öffentlich sein, die Mailadresse steht nicht im Code.
- **Sicherheit.** Text aus der GitHub-API wird mit `textContent` eingefügt, nie mit `innerHTML`. Ein unsichtbares Honeypot-Feld hält einfache Spam-Bots ab.

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

- Web3Forms erlaubt in der Gratisversion 250 Nachrichten pro Monat.
- Die GitHub-API erlaubt ohne Anmeldung nur eine begrenzte Zahl Abfragen pro Stunde. Ist das Limit erreicht, zeigt die Seitenleiste einen Hinweis statt der Liste.
