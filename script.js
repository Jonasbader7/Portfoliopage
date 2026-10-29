/* =========================================================
   Portfolio Jonas Bader – JavaScript
   1. Farbschema hell/dunkel
   2. Mobile Navigation (Menü auf-/zuklappen)
   3. Projekte auf-/zuklappen
   3b. SplitMate-Demo (Schuldenberechnung)
   4. Neuste GitHub-Repositories laden (fetch)
   5. Kontaktformular prüfen
   6. Jahr in der Fusszeile
   ========================================================= */


/* ---------- 1. Farbschema hell/dunkel ---------- */
const themeButton = document.querySelector(".theme-toggle");

// Gespeicherte Wahl lesen. try/catch, weil manche Browser localStorage blockieren.
function gespeichertesSchema() {
    try {
        return localStorage.getItem("farbschema");
    } catch (fehler) {
        return null;
    }
}

function setzeSchema(schema) {
    document.documentElement.dataset.theme = schema; // ergibt data-theme="dark" oder "light"
    const naechstes = schema === "dark" ? "Helles" : "Dunkles";
    themeButton.setAttribute("aria-label", naechstes + " Farbschema einschalten");
    try {
        localStorage.setItem("farbschema", schema);
    } catch (fehler) {
        // Speichern nicht möglich: Seite funktioniert trotzdem
    }
}

// Startwert: gespeicherte Wahl, sonst die Einstellung des Betriebssystems
const systemDunkel = window.matchMedia("(prefers-color-scheme: dark)").matches;
setzeSchema(gespeichertesSchema() || (systemDunkel ? "dark" : "light"));

themeButton.addEventListener("click", function () {
    const aktuell = document.documentElement.dataset.theme;
    setzeSchema(aktuell === "dark" ? "light" : "dark");
});


/* ---------- 2. Mobile Navigation ---------- */
const navButton = document.querySelector(".nav-toggle");
const nav = document.querySelector("#hauptnav");

function setzeMenu(offen) {
    nav.classList.toggle("is-open", offen);
    // aria-expanded sagt Screenreadern, ob das Menü offen ist; das CSS macht daraus das X
    navButton.setAttribute("aria-expanded", offen);
    navButton.querySelector(".visually-hidden").textContent = offen ? "Menü schliessen" : "Menü öffnen";
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

// Escape-Taste schliesst das Menü ebenfalls
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        setzeMenu(false);
    }
});


/* ---------- 3. Projekte auf-/zuklappen ---------- */
const projektKoepfe = document.querySelectorAll(".projekt-kopf");

// Ein Projekt öffnen oder schliessen
function setzeProjekt(kopf, offen) {
    // aria-controls enthält die id des zugehörigen Detailbereichs
    const details = document.getElementById(kopf.getAttribute("aria-controls"));
    kopf.setAttribute("aria-expanded", offen);
    details.hidden = !offen;
}

projektKoepfe.forEach(function (kopf) {
    kopf.addEventListener("click", function () {
        const warOffen = kopf.getAttribute("aria-expanded") === "true";

        // Immer nur ein Projekt offen: zuerst alle schliessen
        projektKoepfe.forEach(function (anderer) {
            setzeProjekt(anderer, false);
        });

        // Dann das angeklickte öffnen, ausser es war schon offen (dann bleibt es zu)
        if (!warOffen) {
            setzeProjekt(kopf, true);
        }
    });
});


/* ---------- 3b. SplitMate-Demo ---------- */
// Gleiche Logik wie im SplitMate-Backend (Strapi-Controller "schulden"):
// 1. Anteil = Total / Anzahl Personen
// 2. Saldo = bezahlt - Anteil (negativ = Schuldner, positiv = Gläubiger)
// 3. Schuldner und Gläubiger der Reihe nach ausgleichen
function berechneSchulden(bezahlt) {
    const personen = Object.keys(bezahlt);
    const total = personen.reduce(function (summe, person) {
        return summe + bezahlt[person];
    }, 0);
    const anteil = total / personen.length;

    const schuldner = [];
    const glaeubiger = [];
    personen.forEach(function (person) {
        const saldo = runde(bezahlt[person] - anteil);
        if (saldo < 0) {
            schuldner.push({ person: person, betrag: -saldo });
        } else if (saldo > 0) {
            glaeubiger.push({ person: person, betrag: saldo });
        }
    });

    // Zwei Zeiger: i läuft durch die Schuldner, j durch die Gläubiger
    const transaktionen = [];
    let i = 0;
    let j = 0;
    while (i < schuldner.length && j < glaeubiger.length) {
        // Es wird so viel bezahlt, wie beide Seiten noch offen haben
        const betrag = runde(Math.min(schuldner[i].betrag, glaeubiger[j].betrag));
        transaktionen.push({ von: schuldner[i].person, an: glaeubiger[j].person, betrag: betrag });

        schuldner[i].betrag -= betrag;
        glaeubiger[j].betrag -= betrag;

        // Wer ausgeglichen ist, ist fertig: zur nächsten Person
        if (schuldner[i].betrag < 0.01) i++;
        if (glaeubiger[j].betrag < 0.01) j++;
    }

    return { total: total, anteil: anteil, transaktionen: transaktionen };
}

// Auf Rappen runden (zwei Nachkommastellen)
function runde(zahl) {
    return Math.round(zahl * 100) / 100;
}

function chf(zahl) {
    return zahl.toFixed(2) + " CHF";
}

const splitDemo = document.querySelector("#split-demo");
const splitErgebnis = document.querySelector("#split-ergebnis");

function zeigeSchulden() {
    // Aus den drei Feldern ein Objekt bauen, z. B. { Anna: 90, Marco: 30, Lea: 0 }
    const bezahlt = {};
    splitDemo.querySelectorAll("input").forEach(function (feld) {
        const wert = Number(feld.value);
        bezahlt[feld.name] = wert > 0 ? wert : 0; // leere oder negative Eingaben zählen als 0
    });

    const resultat = berechneSchulden(bezahlt);

    splitErgebnis.textContent = "Total " + chf(resultat.total) + " · Anteil pro Person " + chf(resultat.anteil);

    const liste = document.createElement("ul");
    if (resultat.transaktionen.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Alle sind quitt.";
        liste.append(li);
    }
    resultat.transaktionen.forEach(function (t) {
        const li = document.createElement("li");
        const betrag = document.createElement("strong");
        betrag.textContent = chf(t.betrag);
        li.append(t.von + " zahlt " + t.an + " ", betrag);
        liste.append(li);
    });
    splitErgebnis.append(liste);
}

// Bei jeder Eingabe neu rechnen; Enter soll die Seite nicht neu laden
splitDemo.addEventListener("input", zeigeSchulden);
splitDemo.addEventListener("submit", function (event) {
    event.preventDefault();
});
zeigeSchulden();


/* ---------- 4. Neuste GitHub-Repositories ---------- */
async function ladeRepos() {
    const zeile = document.querySelector("#repo-zeile");
    const url = "https://api.github.com/users/Jonasbader7/repos?sort=pushed&per_page=10";

    try {
        const antwort = await fetch(url);
        if (!antwort.ok) {
            throw new Error("HTTP " + antwort.status);
        }
        const repos = await antwort.json();

        // Nur eigene Repos (keine Forks), die neusten drei
        const neuste = repos
            .filter(function (repo) { return !repo.fork; })
            .slice(0, 3);

        zeile.append("Zuletzt aktiv: ");
        neuste.forEach(function (repo, index) {
            const link = document.createElement("a");
            link.href = repo.html_url;
            // textContent statt innerHTML: Text von aussen wird nie als HTML ausgeführt
            link.textContent = repo.name;
            zeile.append(link);
            if (index < neuste.length - 1) {
                zeile.append(", ");
            }
        });
    } catch (fehler) {
        // z. B. offline oder API-Limit erreicht: die Zeile bleibt einfach leer
        zeile.hidden = true;
    }
}

ladeRepos();


/* ---------- 5. Kontaktformular ---------- */
const formular = document.querySelector("#kontaktformular");
const statusText = document.querySelector("#formular-status");

// Prüfregeln: pro Feld eine Funktion, die eine Fehlermeldung oder "" zurückgibt
const regeln = {
    name: function (wert) {
        if (wert.length < 2) {
            return "Bitte gib deinen Namen ein.";
        }
        return "";
    },
    email: function (wert) {
        // einfaches Muster: etwas@etwas.etwas
        const muster = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!muster.test(wert)) {
            return "Bitte gib eine gültige E-Mail-Adresse ein.";
        }
        return "";
    },
    nachricht: function (wert) {
        if (wert.length < 20) {
            return "Bitte schreib mindestens 20 Zeichen (aktuell " + wert.length + ").";
        }
        return "";
    }
};

// Ein Feld prüfen und die Meldung darunter anzeigen
function pruefeFeld(feld) {
    const meldung = regeln[feld.name](feld.value.trim());
    const fehlerText = document.querySelector("#" + feld.id + "-fehler");

    fehlerText.textContent = meldung;
    feld.classList.toggle("ist-fehlerhaft", meldung !== "");
    feld.setAttribute("aria-invalid", meldung !== "");

    return meldung === "";
}

const felder = formular.querySelectorAll("input, textarea");

felder.forEach(function (feld) {
    // Prüfen, sobald man das Feld verlässt (nicht schon beim ersten Tippen)
    feld.addEventListener("blur", function () {
        pruefeFeld(feld);
    });
    // Ist ein Fehler angezeigt, verschwindet er, sobald die Eingabe stimmt
    feld.addEventListener("input", function () {
        if (feld.classList.contains("ist-fehlerhaft")) {
            pruefeFeld(feld);
        }
    });
});

formular.addEventListener("submit", function (event) {
    event.preventDefault(); // Seite nicht neu laden

    let erstesFehlerfeld = null;
    felder.forEach(function (feld) {
        const ok = pruefeFeld(feld);
        if (!ok && erstesFehlerfeld === null) {
            erstesFehlerfeld = feld;
        }
    });

    if (erstesFehlerfeld !== null) {
        statusText.hidden = true;
        erstesFehlerfeld.focus(); // direkt zum ersten Fehler springen
        return;
    }

    // Kein echter Versand: Bestätigung anzeigen und Formular leeren
    statusText.textContent = "Danke! Die Angaben sind vollständig. " +
        "Diese Seite verschickt noch keine E-Mails, am schnellsten erreichst du mich über GitHub.";
    statusText.hidden = false;
    formular.reset();
});


/* ---------- 6. Jahr in der Fusszeile ---------- */
document.querySelector("#jahr").textContent = new Date().getFullYear();
