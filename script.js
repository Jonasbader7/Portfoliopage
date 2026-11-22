/* =========================================================
   Portfolio Jonas Bader – JavaScript
   1. Mehrsprachigkeit (Deutsch, Englisch, Französisch)
   2. Mobile Navigation (Menü auf-/zuklappen)
   3. Projektdetails auf-/zuklappen
   4. GreenRoute-Live-Vorschau erst auf Klick laden
   5. Neuste GitHub-Repositories laden (fetch)
   6. Kontaktformular prüfen und über Web3Forms senden
   7. Jahr im Footer
   8. Kopfzeile, Lesefortschritt und aktiver Menüpunkt
   9. Inhalte beim Scrollen einblenden
  10. Werdegang als Zeitachse
  11. Projekt Transparenz: der Tresor
  12. Bilder vergrössern
   ========================================================= */


/* ---------- 1. Mehrsprachigkeit ---------- */

// Texte, die nur im JavaScript vorkommen (Deutsch). Englisch und Französisch stehen in lang/*.json.
const texteDe = {
    "menu.open": "Menü öffnen",
    "menu.close": "Menü schliessen",
    "toggle.more": "Mehr erfahren",
    "toggle.less": "Weniger anzeigen",
    "bors.liveTitle": "GreenRoute-Web-App, Live-Vorschau",
    "form.sending": "Wird gesendet …",
    "form.success": "Danke! Deine Nachricht ist angekommen. Ich melde mich bald.",
    "form.fail": "Die Nachricht konnte leider nicht gesendet werden. Versuch es bitte später nochmals.",
    "err.name": "Bitte gib deinen Namen ein.",
    "err.email": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "err.message": "Bitte schreib mindestens 10 Zeichen (aktuell {n}).",
    "repo.empty": "Noch keine öffentlichen Projekte.",
    "repo.error": "Gerade nicht erreichbar.",
    "vault.unlock": "Entschlüsseln",
    "vault.lock": "Wieder verschliessen",
    "vault.stampLocked": "Unter Verschluss",
    "vault.stampOpen": "Vorschau freigegeben",
    "vault.heartbeat": "Zuletzt daran gearbeitet: {zeit}",
    "zoom.open": "Bild vergrössern",
    "zoom.close": "Schliessen"
};

// Für die Datumsanzeige: welches Sprachformat gehört zu welcher Sprache
const sprachformat = { de: "de-CH", en: "en-GB", fr: "fr-CH" };

let aktuelleSprache = "de";
let aktuelleTexte = texteDe;
const geladeneSprachen = {}; // einmal geladene JSON-Dateien merken, damit sie nicht erneut geladen werden

// Die deutschen Originaltexte aus dem HTML sichern, damit man zurück auf Deutsch wechseln kann
const originaleDe = {
    text: new Map(),
    alt: new Map(),
    aria: new Map()
};
document.querySelectorAll("[data-i18n]").forEach(function (el) {
    originaleDe.text.set(el, el.innerHTML);
});
document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
    originaleDe.alt.set(el, el.alt);
});
document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    originaleDe.aria.set(el, el.getAttribute("aria-label"));
});

// Zahlen mit data-zahl im Format der Sprache schreiben (DE 20'867 und 6,4; EN 20,867 und 6.4).
// Mit Dezimalpunkt im Attribut: eine Nachkommastelle, sonst ganze Zahl.
// Dezimalzahlen auf Deutsch mit Komma wie im übrigen Text (de-CH schreibt 6.4), daher eigenes Format.
const dezimalformat = { de: "de-DE", en: "en-GB", fr: "fr-CH" };

function formatiereZahlen() {
    document.querySelectorAll("[data-zahl]").forEach(function (el) {
        const roh = el.dataset.zahl;
        const stellen = roh.includes(".") ? 1 : 0;
        const format = stellen ? dezimalformat[aktuelleSprache] : sprachformat[aktuelleSprache];
        el.textContent = Number(roh).toLocaleString(format, {
            minimumFractionDigits: stellen,
            maximumFractionDigits: stellen
        });
    });
}

// Einen Text in der aktuellen Sprache holen; fehlt er, gilt der deutsche
function t(schluessel) {
    return aktuelleTexte[schluessel] || texteDe[schluessel] || schluessel;
}

async function setzeSprache(sprache) {
    if (sprache === "de") {
        aktuelleTexte = texteDe;
        originaleDe.text.forEach(function (html, el) { el.innerHTML = html; });
        originaleDe.alt.forEach(function (alt, el) { el.alt = alt; });
        originaleDe.aria.forEach(function (aria, el) { el.setAttribute("aria-label", aria); });
    } else {
        try {
            if (!geladeneSprachen[sprache]) {
                const antwort = await fetch("lang/" + sprache + ".json");
                if (!antwort.ok) {
                    throw new Error("HTTP " + antwort.status);
                }
                geladeneSprachen[sprache] = await antwort.json();
            }
        } catch (fehler) {
            return; // Übersetzung nicht ladbar: Seite bleibt in der bisherigen Sprache
        }
        aktuelleTexte = geladeneSprachen[sprache];

        // innerHTML ist hier unbedenklich: die Texte stammen aus unseren eigenen Dateien, nicht von aussen
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            const text = aktuelleTexte[el.dataset.i18n];
            if (text) el.innerHTML = text;
        });
        document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
            const text = aktuelleTexte[el.dataset.i18nAlt];
            if (text) el.alt = text;
        });
        document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
            const text = aktuelleTexte[el.dataset.i18nAria];
            if (text) el.setAttribute("aria-label", text);
        });
    }

    aktuelleSprache = sprache;
    document.documentElement.lang = sprachformat[sprache];

    // Aktiven Knopf markieren
    document.querySelectorAll(".lang-switch button").forEach(function (knopf) {
        knopf.setAttribute("aria-pressed", knopf.dataset.lang === sprache);
    });

    // Wahl merken. try/catch, weil manche Browser localStorage blockieren.
    try {
        localStorage.setItem("sprache", sprache);
    } catch (fehler) {
        // nicht gespeichert, Seite funktioniert trotzdem
    }

    // Texte, die JavaScript selbst setzt, ebenfalls neu schreiben
    formatiereZahlen();
    aktualisiereToggleTexte();
    setzeMenu(nav.classList.contains("is-open"));
    zeigeRepos();
    aktualisiereTresor();
    aktualisiereZoomTexte();
}

document.querySelectorAll(".lang-switch button").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
        setzeSprache(knopf.dataset.lang);
    });
});

// Startsprache: gespeicherte Wahl, sonst die Sprache des Browsers, sonst Deutsch
function startSprache() {
    try {
        const gespeichert = localStorage.getItem("sprache");
        if (gespeichert) return gespeichert;
    } catch (fehler) {
        // ignorieren
    }
    const browser = navigator.language.slice(0, 2);
    return ["en", "fr"].includes(browser) ? browser : "de";
}


/* ---------- 2. Mobile Navigation ---------- */
const navButton = document.querySelector(".nav-toggle");
const nav = document.querySelector("#hauptnav");

function setzeMenu(offen) {
    nav.classList.toggle("is-open", offen);
    // aria-expanded sagt Screenreadern, ob das Menü offen ist; das CSS macht daraus das X
    navButton.setAttribute("aria-expanded", offen);
    document.querySelector("#nav-toggle-text").textContent = offen ? t("menu.close") : t("menu.open");
}

navButton.addEventListener("click", function () {
    const istOffen = navButton.getAttribute("aria-expanded") === "true";
    setzeMenu(!istOffen);
});

// Nach dem Klick auf einen Link das Menü wieder schliessen
nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
        setzeMenu(false);
    });
});

// Wie man es von Menüs kennt: Escape oder ein Tippen neben das Menü schliesst es
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setzeMenu(false);
        navButton.focus(); // Tastatur-Nutzer landen wieder beim Menüknopf
    }
});

document.addEventListener("click", function (event) {
    if (nav.classList.contains("is-open") && !event.target.closest(".site-header")) {
        setzeMenu(false);
    }
});


/* ---------- 3. Projektdetails auf-/zuklappen ---------- */
const detailKnoepfe = document.querySelectorAll(".details-toggle");

// Knopftext passend zum Zustand und zur Sprache setzen
function aktualisiereToggleTexte() {
    detailKnoepfe.forEach(function (knopf) {
        const offen = knopf.getAttribute("aria-expanded") === "true";
        knopf.textContent = offen ? t("toggle.less") : t("toggle.more");
    });
}

detailKnoepfe.forEach(function (knopf) {
    knopf.addEventListener("click", function () {
        // aria-controls enthält die id des Detailbereichs, der zu diesem Knopf gehört
        const details = document.getElementById(knopf.getAttribute("aria-controls"));
        const offen = knopf.getAttribute("aria-expanded") === "true";
        const vorher = knopf.getBoundingClientRect().top;

        details.hidden = offen;
        knopf.setAttribute("aria-expanded", !offen);
        aktualisiereToggleTexte();

        // Beim Zuklappen schrumpft die Seite über dem Knopf (bei GreenRoute um mehrere Bildschirme).
        // Damit man nicht irgendwo im nächsten Abschnitt landet, bleibt der Knopf an derselben Stelle.
        if (offen) {
            window.scrollBy({ top: knopf.getBoundingClientRect().top - vorher, behavior: "instant" });
        }
    });
});


/* ---------- 4. GreenRoute-Live-Vorschau ---------- */
// Die GreenRoute-App ist gross. Sie wird deshalb erst geladen, wenn jemand darauf klickt.
const liveButton = document.querySelector("#bors-live-button");

liveButton.addEventListener("click", function () {
    const iframe = document.createElement("iframe");
    iframe.src = "https://jonasbader7.github.io/GreenRoute/";
    iframe.title = t("bors.liveTitle");
    iframe.loading = "lazy";

    // Knopf durch die eingebettete App ersetzen
    liveButton.replaceWith(iframe);
});


/* ---------- 5. Neuste GitHub-Repositories ---------- */
let repos = null;       // geladene Liste, null = noch am Laden
let repoFehler = false; // true, wenn die API nicht erreichbar war
let transparenzStand = null; // letzter Push im Repo Projekt-Transparenz (für den Tresor, Teil 11)

// Ohne Anmeldung erlaubt die GitHub-API nur 60 Abfragen pro Stunde und IP-Adresse.
// Damit die Liste auch in einem gemeinsamen Netz (z. B. bei einer Präsentation) erscheint,
// wird die Antwort eine Stunde im Browser zwischengespeichert.
// «-v3»: neuer Name, damit ältere Zwischenspeicher (ohne Transparenz-Stand) nicht mehr gelten.
const REPO_CACHE_KEY = "github-repos-v3";
const REPO_CACHE_MS = 60 * 60 * 1000;

// Repositories, die nicht in der Liste erscheinen sollen: Hausaufgaben und das Profil-README
// (das Repo mit dem eigenen Benutzernamen zeigt GitHub oben auf der Profilseite an)
const REPOS_AUSGEBLENDET = ["EMPR_HW1", "Jonasbader7"];

function leseRepoCache() {
    try {
        const roh = localStorage.getItem(REPO_CACHE_KEY);
        return roh ? JSON.parse(roh) : null; // { zeit: ..., liste: [...] }
    } catch (fehler) {
        return null; // localStorage blockiert oder Inhalt beschädigt
    }
}

function schreibeRepoCache(liste, transparenz) {
    try {
        localStorage.setItem(REPO_CACHE_KEY, JSON.stringify({ zeit: Date.now(), liste: liste, transparenz: transparenz }));
    } catch (fehler) {
        // nicht gespeichert, die Liste wird beim nächsten Besuch neu geladen
    }
}

async function ladeRepos() {
    const cache = leseRepoCache();

    // 1. Frischer Zwischenspeicher: gar keine Anfrage an GitHub
    if (cache && Date.now() - cache.zeit < REPO_CACHE_MS) {
        repos = cache.liste;
        transparenzStand = cache.transparenz || null;
        zeigeRepos();
        aktualisiereTresor();
        return;
    }

    // 2. Sonst bei GitHub nachfragen
    const url = "https://api.github.com/users/Jonasbader7/repos?sort=pushed&per_page=10";
    try {
        const antwort = await fetch(url);
        if (!antwort.ok) {
            throw new Error("HTTP " + antwort.status);
        }
        const alle = await antwort.json();
        // Nur eigene Repos (keine Forks, nichts Ausgeblendetes), die neusten drei.
        // Gespeichert werden nur die drei Felder, die die Liste braucht.
        repos = alle
            .filter(function (repo) { return !repo.fork && !REPOS_AUSGEBLENDET.includes(repo.name); })
            .slice(0, 3)
            .map(function (repo) {
                return { name: repo.name, html_url: repo.html_url, pushed_at: repo.pushed_at };
            });
        const transparenz = alle.find(function (repo) { return repo.name === "Projekt-Transparenz"; });
        transparenzStand = transparenz ? transparenz.pushed_at : null;
        schreibeRepoCache(repos, transparenzStand);
    } catch (fehler) {
        // 3. GitHub nicht erreichbar (offline, API-Limit): lieber eine ältere Liste als keine
        if (cache) {
            repos = cache.liste;
            transparenzStand = cache.transparenz || null;
        } else {
            repoFehler = true;
        }
    }
    zeigeRepos();
    aktualisiereTresor();
}

// Liste in der aktuellen Sprache anzeigen (wird auch beim Sprachwechsel aufgerufen)
function zeigeRepos() {
    const liste = document.querySelector("#repo-liste");
    if (repos === null && !repoFehler) {
        return; // lädt noch, Platzhalter bleibt stehen
    }
    liste.innerHTML = "";

    if (repoFehler || repos.length === 0) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = repoFehler ? t("repo.error") : t("repo.empty");
        liste.append(li);
        return;
    }

    repos.forEach(function (repo) {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = repo.html_url;
        // textContent statt innerHTML: Text von aussen wird nie als HTML ausgeführt
        link.textContent = repo.name;

        const datum = document.createElement("span");
        datum.textContent = " · " + new Date(repo.pushed_at).toLocaleDateString(sprachformat[aktuelleSprache]);

        li.append(link, datum);
        liste.append(li);
    });
}


/* ---------- 6. Kontaktformular ---------- */
// Web3Forms leitet das Formular per E-Mail weiter. Der Zugangsschlüssel darf öffentlich sein:
// er erlaubt nur, Nachrichten an die hinterlegte Adresse zu schicken.
const WEB3FORMS_KEY = "28c9c615-a07b-4a9a-b0ea-83af4ea7c8b8";

const formular = document.querySelector("#kontaktformular");
const statusText = document.querySelector("#formular-status");
const sendenKnopf = formular.querySelector("button[type=submit]");
const felder = formular.querySelectorAll("input:not(.honeypot), textarea");

// Kurz genug für «Bitte um Rückruf», lang genug gegen versehentliches Absenden
const MIN_NACHRICHT = 10;

// Prüfregeln: pro Feld eine Funktion, die eine Fehlermeldung oder "" zurückgibt
const regeln = {
    name: function (wert) {
        return wert.length < 2 ? t("err.name") : "";
    },
    email: function (wert) {
        // einfaches Muster: etwas@etwas.etwas
        const muster = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return muster.test(wert) ? "" : t("err.email");
    },
    nachricht: function (wert) {
        return wert.length < MIN_NACHRICHT ? t("err.message").replace("{n}", wert.length) : "";
    }
};

// Ein Feld prüfen und die Meldung darunter anzeigen
function pruefeFeld(feld) {
    const meldung = regeln[feld.name](feld.value.trim());
    document.querySelector("#" + feld.id + "-fehler").textContent = meldung;
    feld.classList.toggle("is-invalid", meldung !== "");
    feld.setAttribute("aria-invalid", meldung !== "");
    return meldung === "";
}

felder.forEach(function (feld) {
    // Prüfen, sobald man das Feld verlässt
    feld.addEventListener("blur", function () {
        pruefeFeld(feld);
    });
    // Ein angezeigter Fehler verschwindet, sobald die Eingabe stimmt
    feld.addEventListener("input", function () {
        if (feld.classList.contains("is-invalid")) {
            pruefeFeld(feld);
        }
    });
});

function zeigeStatus(text, istFehler) {
    statusText.textContent = text;
    statusText.classList.toggle("is-error", istFehler);
    statusText.hidden = false;
}

formular.addEventListener("submit", async function (event) {
    event.preventDefault(); // Seite nicht neu laden

    // 1. Alle Felder prüfen, beim ersten Fehler dorthin springen
    let erstesFehlerfeld = null;
    felder.forEach(function (feld) {
        if (!pruefeFeld(feld) && erstesFehlerfeld === null) {
            erstesFehlerfeld = feld;
        }
    });
    if (erstesFehlerfeld !== null) {
        statusText.hidden = true;
        erstesFehlerfeld.focus();
        return;
    }

    // 2. An Web3Forms senden
    sendenKnopf.disabled = true;
    zeigeStatus(t("form.sending"), false);

    try {
        const antwort = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                access_key: WEB3FORMS_KEY,
                subject: "Neue Nachricht über das Portfolio",
                from_name: "Portfolio Jonas Bader",
                // formular.elements.name statt formular.name: formular.name wäre das name-Attribut des Formulars
                name: formular.elements.name.value.trim(),
                email: formular.elements.email.value.trim(),
                message: formular.elements.nachricht.value.trim(),
                botcheck: formular.elements.botcheck.checked
            })
        });
        const resultat = await antwort.json();
        if (!resultat.success) {
            throw new Error(resultat.message);
        }

        zeigeStatus(t("form.success"), false);
        formular.reset();
    } catch (fehler) {
        zeigeStatus(t("form.fail"), true);
    } finally {
        sendenKnopf.disabled = false; // Knopf in jedem Fall wieder freigeben
    }
});


/* ---------- 7. Jahr im Footer ---------- */
document.querySelector("#year").textContent = new Date().getFullYear();


/* ---------- 8. Kopfzeile, Lesefortschritt und aktiver Menüpunkt ---------- */
const kopfzeile = document.querySelector(".site-header");
const fortschritt = document.querySelector(".scroll-progress");
const nachOben = document.querySelector(".to-top");
let scrollGeplant = false;

// Beim Scrollen höchstens einmal pro Bild rechnen (requestAnimationFrame)
function aktualisiereScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const anteil = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    fortschritt.style.setProperty("--progress", anteil.toFixed(4));
    kopfzeile.classList.toggle("is-scrolled", window.scrollY > 8);
    // «Nach oben» erst zeigen, wenn man gut eineinhalb Bildschirme weit gescrollt hat
    nachOben.classList.toggle("is-shown", window.scrollY > window.innerHeight * 1.5);
    scrollGeplant = false;
}

window.addEventListener("scroll", function () {
    if (!scrollGeplant) {
        scrollGeplant = true;
        requestAnimationFrame(aktualisiereScroll);
    }
}, { passive: true });
aktualisiereScroll();

// Menüpunkt des Abschnitts markieren, der gerade in der Bildmitte liegt
const menuLinks = document.querySelectorAll(".nav-list a");
const abschnittBeobachter = new IntersectionObserver(function (eintraege) {
    eintraege.forEach(function (eintrag) {
        if (!eintrag.isIntersecting) return;
        menuLinks.forEach(function (link) {
            if (link.getAttribute("href") === "#" + eintrag.target.id) {
                link.setAttribute("aria-current", "true");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    });
}, { rootMargin: "-45% 0px -50% 0px" }); // nur ein schmaler Streifen in der Bildmitte zählt

document.querySelectorAll("#profile, #projects, #skills, #contact").forEach(function (abschnitt) {
    abschnittBeobachter.observe(abschnitt);
});

// Ganz oben (im Hero) ist kein Abschnitt aktiv
window.addEventListener("scroll", function () {
    if (window.scrollY < 200) {
        menuLinks.forEach(function (link) { link.removeAttribute("aria-current"); });
    }
}, { passive: true });


/* ---------- 9. Inhalte beim Scrollen einblenden ---------- */
// Nur wenn keine reduzierte Bewegung eingestellt ist und der Browser es kann
const wenigBewegung = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!wenigBewegung && "IntersectionObserver" in window) {
    const einblendBeobachter = new IntersectionObserver(function (eintraege, beobachter) {
        eintraege.forEach(function (eintrag) {
            if (!eintrag.isIntersecting) return;
            const el = eintrag.target;
            el.classList.add("is-visible");
            beobachter.unobserve(el);
            // Nach dem Einblenden die Klassen entfernen, damit Hover-Effekte wieder ihr eigenes Tempo haben
            el.addEventListener("transitionend", function () {
                el.classList.remove("reveal", "is-visible");
            }, { once: true });
        });
    }, { rootMargin: "0px 0px -8% 0px" });

    const kandidaten = document.querySelectorAll(
        "main > section > h2, #profile p, .about-subtitle, .project-card, .section-label, .work-item, .vault, .timeline, .section-intro, .skill-card, .sidebar, .contact-form"
    );
    kandidaten.forEach(function (el) {
        // Was schon sichtbar ist, bleibt sichtbar (kein Aufblitzen beim Laden)
        if (el.getBoundingClientRect().top > window.innerHeight) {
            el.classList.add("reveal");
            einblendBeobachter.observe(el);
        }
    });

    // Karten in derselben Reihe leicht versetzt einblenden
    document.querySelectorAll(".project-card.reveal").forEach(function (karte, i) {
        karte.style.transitionDelay = (i % 2) * 80 + "ms";
        karte.addEventListener("transitionend", function () {
            karte.style.transitionDelay = "";
        }, { once: true });
    });
}


/* ---------- 10. Werdegang als Zeitachse ---------- */
// Jede Zeile trägt Beginn und Ende als Dezimaljahr (data-von / data-bis, 2016.583 = August 2016).
// Hier entstehen daraus die Achse (ganze Jahre, Striche alle zwei Jahre), die Linie «heute»
// und bei laufenden Stationen der Anteil bis heute. Position und Breite rechnet das CSS.
const zeitachse = document.querySelector("#werdegang");

function alsDezimaljahr(datum) {
    const jahresbeginn = new Date(datum.getFullYear(), 0, 1);
    const naechstesJahr = new Date(datum.getFullYear() + 1, 0, 1);
    return datum.getFullYear() + (datum - jahresbeginn) / (naechstesJahr - jahresbeginn);
}

if (zeitachse) {
    const zeilen = zeitachse.querySelectorAll(".tl-row");
    const heute = alsDezimaljahr(new Date());

    // Achse: vom ersten geraden Jahr vor dem frühesten Beginn bis zum Jahr nach dem spätesten Ende
    let fruehester = Infinity;
    let spaetester = -Infinity;
    zeilen.forEach(function (zeile) {
        fruehester = Math.min(fruehester, parseFloat(zeile.dataset.von));
        spaetester = Math.max(spaetester, parseFloat(zeile.dataset.bis));
    });
    const achseVon = Math.floor(fruehester / 2) * 2;
    const achseBis = Math.ceil(spaetester);

    zeitachse.style.setProperty("--tl-start", achseVon);
    zeitachse.style.setProperty("--tl-span", achseBis - achseVon);
    zeitachse.style.setProperty("--heute", heute.toFixed(3));

    zeilen.forEach(function (zeile, i) {
        const von = parseFloat(zeile.dataset.von);
        const bis = parseFloat(zeile.dataset.bis);
        zeile.style.setProperty("--von", von);
        zeile.style.setProperty("--bis", bis);
        zeile.style.setProperty("--i", i); // für das versetzte Wachsen der Balken

        // Läuft noch: bis heute voll, danach schraffiert
        if (bis > heute) {
            const anteil = Math.min(100, Math.max(0, (heute - von) / (bis - von) * 100));
            zeile.classList.add("is-laufend");
            zeile.style.setProperty("--ist", anteil.toFixed(1) + "%");
        }
    });

    // Jahreszahlen alle zwei Jahre
    const striche = zeitachse.querySelector(".tl-ticks");
    for (let jahr = achseVon; jahr < achseBis; jahr += 2) {
        const marke = document.createElement("span");
        marke.textContent = jahr;
        marke.style.setProperty("--jahr", jahr);
        striche.append(marke);
    }

    zeitachse.classList.add("is-ready");

    // Balken wachsen lassen, sobald die Zeitachse zu sehen ist
    if (wenigBewegung || !("IntersectionObserver" in window)) {
        zeitachse.classList.add("is-drawn");
    } else {
        const zeichner = new IntersectionObserver(function (eintraege, beobachter) {
            if (eintraege[0].isIntersecting) {
                zeitachse.classList.add("is-drawn");
                beobachter.disconnect();
            }
        }, { threshold: 0.3 });
        zeichner.observe(zeitachse);
    }
}


/* ---------- 11. Projekt Transparenz: der Tresor ---------- */
// Ein Projekt über Transparenz, das noch nicht fertig ist: Der Text erscheint als Zeichensalat
// und wird per Knopf «entschlüsselt». Das ist Inszenierung, keine echte Verschlüsselung: Der
// Klartext steht im HTML (übersetzbar per data-i18n), Screenreader lesen ihn immer vor, und
// ohne JavaScript ist alles offen. Die Zeichen liegen in einer zweiten Zeile mit derselben
// Monospace-Schrift darüber, deshalb springt beim Umschalten nichts.
const tresor = document.querySelector("#vault");
const CHIFFRE_ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=/<>";
const tresorChiffre = document.createElement("p");
let tresorOffen = false;
let tresorZiel = [];      // Zeichen des Klartexts
let tresorJetzt = [];     // aktuell angezeigte Zeichen
let tresorZeit = [];      // ab welchem Anteil (0–1) ein Zeichen entschlüsselt ist
let tresorSpans = [];     // [{ span, von, bis }], geschwärzte Stellen bekommen eigene spans
let tresorAnimation = 0;
let tresorAnimiert = false;
let tresorSichtbar = false;

function zufallsZeichen() {
    return CHIFFRE_ZEICHEN[Math.floor(Math.random() * CHIFFRE_ZEICHEN.length)];
}

// Klartext in Abschnitte zerlegen (normaler Text und geschwärzte Stellen) und die Chiffre-Zeile aufbauen
function baueChiffre() {
    const klartext = tresor.querySelector(".vault-text:not(.vault-cipher)");
    const teile = [];
    klartext.childNodes.forEach(function (knoten) {
        const geschwaerzt = knoten.nodeType === 1 && knoten.classList.contains("redacted");
        teile.push({ text: knoten.textContent.replace(/\s+/g, " "), geschwaerzt: geschwaerzt });
    });
    if (teile.length) {
        teile[0].text = teile[0].text.trimStart();
        teile[teile.length - 1].text = teile[teile.length - 1].text.trimEnd();
    }

    tresorChiffre.replaceChildren();
    tresorZiel = [];
    tresorSpans = [];
    teile.forEach(function (teil) {
        const span = document.createElement("span");
        if (teil.geschwaerzt) span.className = "redacted";
        tresorChiffre.append(span);
        tresorSpans.push({ span: span, von: tresorZiel.length, bis: tresorZiel.length + teil.text.length });
        tresorZiel.push.apply(tresorZiel, Array.from(teil.text));
    });

    // Von links nach rechts entschlüsseln, mit etwas Zufall, damit es nicht wie eine Schreibmaschine wirkt
    const n = tresorZiel.length;
    tresorZeit = tresorZiel.map(function (zeichen, i) {
        return 0.05 + 0.72 * (i / n) + 0.22 * Math.random();
    });
    tresorJetzt = tresorZiel.map(function (zeichen) {
        return zeichen === " " ? " " : zufallsZeichen();
    });
}

// anteil: 0 = alles verschlüsselt, 1 = alles Klartext. neuWuerfeln: wie viele Zeichen sich ändern
function zeichneChiffre(anteil, neuWuerfeln) {
    tresorZiel.forEach(function (zeichen, i) {
        if (zeichen === " " || anteil >= tresorZeit[i]) {
            tresorJetzt[i] = zeichen;
        } else if (tresorJetzt[i] === zeichen || Math.random() < neuWuerfeln) {
            tresorJetzt[i] = zufallsZeichen();
        }
    });
    tresorSpans.forEach(function (teil) {
        teil.span.textContent = tresorJetzt.slice(teil.von, teil.bis).join("");
    });
}

function beschrifteTresor() {
    tresor.querySelector(".vault-toggle-text").textContent = tresorOffen ? t("vault.lock") : t("vault.unlock");
    tresor.querySelector(".vault-stamp").textContent = tresorOffen ? t("vault.stampOpen") : t("vault.stampLocked");
}

function setzeTresor(offen, animiert) {
    const klartext = tresor.querySelector(".vault-text:not(.vault-cipher)");
    const knopf = tresor.querySelector(".vault-toggle");
    tresorOffen = offen;
    tresor.classList.toggle("is-open", offen);
    knopf.setAttribute("aria-expanded", offen);
    document.getElementById(knopf.getAttribute("aria-controls")).hidden = !offen;
    beschrifteTresor();

    // Während der Animation die Chiffre zeigen, danach je nach Zustand Klartext oder Chiffre
    cancelAnimationFrame(tresorAnimation);
    klartext.classList.add("visually-hidden");
    tresorChiffre.hidden = false;
    const dauer = animiert && !wenigBewegung ? (offen ? 1300 : 450) : 0;
    const start = performance.now();
    tresorAnimiert = true;

    function schritt(jetzt) {
        const p = dauer ? Math.min(1, (jetzt - start) / dauer) : 1;
        zeichneChiffre(offen ? p : 1 - p, 0.6);
        if (p < 1) {
            tresorAnimation = requestAnimationFrame(schritt);
            return;
        }
        tresorAnimiert = false;
        if (offen) {
            klartext.classList.remove("visually-hidden");
            tresorChiffre.hidden = true;
        }
    }
    schritt(start);
}

// Zeitangabe wie «vor 3 Stunden» in der aktuellen Sprache
function relativeZeit(iso) {
    const sekunden = (new Date(iso) - Date.now()) / 1000;
    const stufen = [["hour", 3600], ["day", 86400], ["week", 604800], ["month", 2629800], ["year", 31557600]];
    let einheit = "minute";
    let wert = sekunden / 60;
    stufen.forEach(function (stufe) {
        if (Math.abs(sekunden) >= stufe[1]) {
            einheit = stufe[0];
            wert = sekunden / stufe[1];
        }
    });
    return new Intl.RelativeTimeFormat(sprachformat[aktuelleSprache], { numeric: "auto" })
        .format(Math.round(wert), einheit);
}

// Bei Sprachwechsel und sobald GitHub geantwortet hat: Texte, Chiffre und «Zuletzt daran gearbeitet»
function aktualisiereTresor() {
    if (!tresor) return;
    beschrifteTresor();
    if (!tresorAnimiert) {
        baueChiffre();
        zeichneChiffre(tresorOffen ? 1 : 0, 1);
    }

    const puls = tresor.querySelector(".vault-heartbeat");
    if (transparenzStand) {
        puls.textContent = t("vault.heartbeat").replace("{zeit}", relativeZeit(transparenzStand));
        puls.hidden = false;
        // Pulsierender Punkt nur, wenn in den letzten zwei Wochen wirklich daran gearbeitet wurde
        tresor.classList.toggle("is-active", Date.now() - new Date(transparenzStand) < 14 * 86400000);
    }
}

if (tresor) {
    tresorChiffre.className = "vault-text vault-cipher";
    tresorChiffre.setAttribute("aria-hidden", "true");
    tresor.querySelector(".vault-text").after(tresorChiffre);

    const knopf = tresor.querySelector(".vault-toggle");
    knopf.hidden = false;
    knopf.addEventListener("click", function () {
        setzeTresor(!tresorOffen, true);
    });

    baueChiffre();
    setzeTresor(false, false);
    tresor.classList.add("is-ready");

    // Solange verschlossen und sichtbar, flimmern einzelne Zeichen leicht
    if (!wenigBewegung && "IntersectionObserver" in window) {
        new IntersectionObserver(function (eintraege) {
            tresorSichtbar = eintraege[0].isIntersecting;
        }).observe(tresor);
        setInterval(function () {
            if (tresorSichtbar && !tresorOffen && !tresorAnimiert && !document.hidden) {
                zeichneChiffre(0, 0.07);
            }
        }, 120);
    }
}


/* ---------- 12. Bilder vergrössern ---------- */
// Screenshots von Karten sind auf dem Handy klein. Ein Tippen öffnet sie gross in einem <dialog>:
// showModal() hält den Fokus im Dialog, Escape schliesst ihn, danach springt der Fokus zurück.
// Ein Tippen irgendwo (Bild, Hintergrund, ×) schliesst ihn wieder.
const lightbox = document.createElement("dialog");
lightbox.className = "lightbox";
lightbox.innerHTML =
    '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<button type="button" class="lightbox-close"><span aria-hidden="true">×</span></button>';
const lightboxBild = lightbox.querySelector("img");
const lightboxText = lightbox.querySelector("figcaption");
const lightboxZu = lightbox.querySelector(".lightbox-close");

function aktualisiereZoomTexte() {
    document.querySelectorAll(".zoom-hint").forEach(function (el) {
        el.textContent = t("zoom.open");
    });
    lightboxZu.setAttribute("aria-label", t("zoom.close"));
}

if (typeof lightbox.showModal === "function") {
    document.body.append(lightbox);
    lightbox.addEventListener("click", function () {
        lightbox.close();
    });

    document.querySelectorAll(".project-image img, .project-details figure img").forEach(function (bild) {
        // Bild in einen Knopf legen, damit es auch per Tastatur erreichbar ist
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "zoom";
        knopf.setAttribute("aria-haspopup", "dialog");
        const hinweis = document.createElement("span");
        hinweis.className = "zoom-hint visually-hidden";
        bild.replaceWith(knopf);
        knopf.append(bild, hinweis);

        knopf.addEventListener("click", function () {
            const legende = bild.closest("figure").querySelector("figcaption");
            lightboxBild.src = bild.currentSrc || bild.src;
            lightboxBild.alt = bild.alt;
            lightboxText.textContent = legende ? legende.textContent.replace(/\s+/g, " ").trim() : "";
            lightboxText.hidden = !legende;
            lightbox.showModal();
        });
    });
}


/* ---------- Start ---------- */
ladeRepos();
setzeSprache(startSprache());
