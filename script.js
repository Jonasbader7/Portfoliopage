/* =========================================================
   Portfolio Jonas Bader – JavaScript
   1. Mobile Navigation (Menü auf-/zuklappen)
   2. Projektdetails auf-/zuklappen
   3. BORS-Live-Vorschau erst auf Klick laden
   4. Neuste GitHub-Repositories laden (fetch)
   5. Kontaktformular prüfen
   6. Jahr im Footer
   ========================================================= */


/* ---------- 1. Mobile Navigation ---------- */
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


/* ---------- 2. Projektdetails auf-/zuklappen ---------- */
document.querySelectorAll(".details-toggle").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
        // aria-controls enthält die id des Detailbereichs, der zu diesem Knopf gehört
        const details = document.getElementById(knopf.getAttribute("aria-controls"));
        const offen = knopf.getAttribute("aria-expanded") === "true";

        details.hidden = offen;
        knopf.setAttribute("aria-expanded", !offen);
        knopf.textContent = offen ? "Mehr erfahren" : "Weniger anzeigen";
    });
});


/* ---------- 3. BORS-Live-Vorschau ---------- */
// Die BORS-App ist gross. Sie wird deshalb erst geladen, wenn jemand darauf klickt.
const liveButton = document.querySelector("#bors-live-button");

liveButton.addEventListener("click", function () {
    const iframe = document.createElement("iframe");
    iframe.src = "https://jonasbader7.github.io/BORS/";
    iframe.title = "BORS-Web-App, Live-Vorschau";
    iframe.loading = "lazy";

    // Knopf durch die eingebettete App ersetzen
    liveButton.replaceWith(iframe);
});


/* ---------- 4. Neuste GitHub-Repositories ---------- */
async function ladeRepos() {
    const liste = document.querySelector("#repo-liste");
    const url = "https://api.github.com/users/Jonasbader7/repos?sort=pushed&per_page=10";

    try {
        const antwort = await fetch(url);
        if (!antwort.ok) {
            throw new Error("HTTP " + antwort.status);
        }
        const repos = await antwort.json();
        liste.innerHTML = "";

        // Nur eigene Repos (keine Forks), die neusten drei
        repos
            .filter(function (repo) { return !repo.fork; })
            .slice(0, 3)
            .forEach(function (repo) {
                const li = document.createElement("li");
                const link = document.createElement("a");
                link.href = repo.html_url;
                // textContent statt innerHTML: Text von aussen wird nie als HTML ausgeführt
                link.textContent = repo.name;

                const datum = document.createElement("span");
                datum.textContent = " · " + new Date(repo.pushed_at).toLocaleDateString("de-CH");

                li.append(link, datum);
                liste.append(li);
            });
    } catch (fehler) {
        // z. B. offline oder API-Limit erreicht
        liste.innerHTML = "";
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = "Gerade nicht erreichbar.";
        liste.append(li);
    }
}

ladeRepos();


/* ---------- 5. Kontaktformular ---------- */
const formular = document.querySelector("#kontaktformular");
const statusText = document.querySelector("#formular-status");
const felder = formular.querySelectorAll("input, textarea");

// Prüfregeln: pro Feld eine Funktion, die eine Fehlermeldung oder "" zurückgibt
const regeln = {
    name: function (wert) {
        return wert.length < 2 ? "Bitte gib deinen Namen ein." : "";
    },
    email: function (wert) {
        // einfaches Muster: etwas@etwas.etwas
        const muster = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return muster.test(wert) ? "" : "Bitte gib eine gültige E-Mail-Adresse ein.";
    },
    nachricht: function (wert) {
        return wert.length < 20 ? "Bitte schreib mindestens 20 Zeichen (aktuell " + wert.length + ")." : "";
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

formular.addEventListener("submit", function (event) {
    event.preventDefault(); // Seite nicht neu laden

    let erstesFehlerfeld = null;
    felder.forEach(function (feld) {
        if (!pruefeFeld(feld) && erstesFehlerfeld === null) {
            erstesFehlerfeld = feld;
        }
    });

    if (erstesFehlerfeld !== null) {
        statusText.hidden = true;
        erstesFehlerfeld.focus(); // direkt zum ersten Fehler springen
        return;
    }

    // Kein echter Versand: Bestätigung anzeigen und Formular leeren
    statusText.textContent = "Danke! Alles korrekt ausgefüllt. Diese Seite verschickt noch keine E-Mails, " +
        "am schnellsten erreichst du mich über GitHub.";
    statusText.hidden = false;
    formular.reset();
});


/* ---------- 6. Jahr im Footer ---------- */
document.querySelector("#year").textContent = new Date().getFullYear();
