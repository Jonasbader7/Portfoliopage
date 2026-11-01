/* =========================================================
   Portfolio Jonas Bader – JavaScript
   1. Mehrsprachigkeit (Deutsch, Englisch, Französisch)
   2. Mobile Navigation (Menü auf-/zuklappen)
   3. Projektdetails auf-/zuklappen
   4. BORS-Live-Vorschau erst auf Klick laden
   5. Neuste GitHub-Repositories laden (fetch)
   6. Kontaktformular prüfen und über Web3Forms senden
   7. Jahr im Footer
   ========================================================= */


/* ---------- 1. Mehrsprachigkeit ---------- */

// Texte, die nur im JavaScript vorkommen (Deutsch). Englisch und Französisch stehen in lang/*.json.
const texteDe = {
    "menu.open": "Menü öffnen",
    "menu.close": "Menü schliessen",
    "toggle.more": "Mehr erfahren",
    "toggle.less": "Weniger anzeigen",
    "bors.liveTitle": "BORS-Web-App, Live-Vorschau",
    "form.sending": "Wird gesendet …",
    "form.success": "Danke! Deine Nachricht ist angekommen. Ich melde mich bald.",
    "form.fail": "Die Nachricht konnte leider nicht gesendet werden. Versuch es später nochmals oder schreib mir über GitHub.",
    "err.name": "Bitte gib deinen Namen ein.",
    "err.email": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "err.message": "Bitte schreib mindestens 20 Zeichen (aktuell {n}).",
    "repo.empty": "Noch keine öffentlichen Projekte.",
    "repo.error": "Gerade nicht erreichbar."
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
    aktualisiereToggleTexte();
    setzeMenu(nav.classList.contains("is-open"));
    zeigeRepos();
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

        details.hidden = offen;
        knopf.setAttribute("aria-expanded", !offen);
        aktualisiereToggleTexte();
    });
});


/* ---------- 4. BORS-Live-Vorschau ---------- */
// Die BORS-App ist gross. Sie wird deshalb erst geladen, wenn jemand darauf klickt.
const liveButton = document.querySelector("#bors-live-button");

liveButton.addEventListener("click", function () {
    const iframe = document.createElement("iframe");
    iframe.src = "https://jonasbader7.github.io/BORS/";
    iframe.title = t("bors.liveTitle");
    iframe.loading = "lazy";

    // Knopf durch die eingebettete App ersetzen
    liveButton.replaceWith(iframe);
});


/* ---------- 5. Neuste GitHub-Repositories ---------- */
let repos = null;       // geladene Liste, null = noch am Laden
let repoFehler = false; // true, wenn die API nicht erreichbar war

async function ladeRepos() {
    const url = "https://api.github.com/users/Jonasbader7/repos?sort=pushed&per_page=10";
    try {
        const antwort = await fetch(url);
        if (!antwort.ok) {
            throw new Error("HTTP " + antwort.status);
        }
        const alle = await antwort.json();
        // Nur eigene Repos (keine Forks), die neusten drei
        repos = alle.filter(function (repo) { return !repo.fork; }).slice(0, 3);
    } catch (fehler) {
        // z. B. offline oder API-Limit erreicht
        repoFehler = true;
    }
    zeigeRepos();
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
        return wert.length < 20 ? t("err.message").replace("{n}", wert.length) : "";
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


/* ---------- Start ---------- */
ladeRepos();
setzeSprache(startSprache());
