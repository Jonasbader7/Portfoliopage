/* Privacy-aware analytics for Jonas Bader's GitHub Pages websites.
 * No request is sent until the visitor explicitly opts in AND an endpoint is configured.
 * No form content, search queries, route coordinates, full URLs or GPS data are collected.
 */
(function () {
  "use strict";
  var config = window.JB_ANALYTICS_CONFIG || {};
  if (!config.endpoint || typeof config.endpoint !== "string") return;
  var endpoint;
  try {
    endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.pathname !== "/collect") return;
  } catch (_) { return; }

  // Respect browser privacy preferences.
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === "1") return;

  var script = document.currentScript;
  var site = script && script.dataset.analyticsSite === "bors" ? "bors" : "portfolio";
  var key = "jonas-analytics-consent-v1";
  var sessionKey = "jonas-analytics-tab-session-v1";
  var enabled = false;
  var started = false;
  var foregroundFrom = 0;
  var banner = null;

  function language() {
    var l = (document.documentElement.lang || "de").slice(0, 2).toLowerCase();
    return l === "en" || l === "fr" ? l : "de";
  }
  var labels = {
    de: {
      heading: "Darf ich die Nutzung dieser Seite analysieren?",
      body: "Mit deiner Einwilligung erfasse ich Seitenaufrufe, Klickkategorien, ungefähr die Nutzungsdauer, Browser, Geräteart sowie Land, Region und ungefähre Stadt. Für technische Sicherheitsanalysen wird auch deine vollständige IP-Adresse für bis zu 14 Tage in einem geschützten Protokoll gespeichert. Pseudonyme Nutzungsdaten werden nach spätestens 180 Tagen gelöscht. Keine Formulareingaben, Streckensuchen oder GPS-Daten.",
      yes: "Zustimmen", no: "Ablehnen", settings: "Analyse-Einstellungen", details: "Datenschutzhinweise"
    },
    en: {
      heading: "May I analyse how this page is used?",
      body: "With your consent, I collect page views, categories of clicks, approximate time on page, browser, device type, country, region and approximate city. For security diagnostics, your full IP address is also held in a protected log for up to 14 days. Pseudonymous usage data is deleted within 180 days. No form input, route searches or GPS data.",
      yes: "Accept", no: "Decline", settings: "Analytics settings", details: "Privacy details"
    },
    fr: {
      heading: "Puis-je analyser l'utilisation de cette page ?",
      body: "Avec votre accord, je collecte les pages vues, les catégories de clics, la durée approximative, le navigateur, le type d'appareil, le pays, la région et la ville approximative. À des fins de sécurité, votre adresse IP complète est conservée dans un journal protégé pendant 14 jours au maximum. Les données d'utilisation pseudonymisées sont supprimées sous 180 jours. Aucune saisie de formulaire, recherche d'itinéraire ni donnée GPS.",
      yes: "Accepter", no: "Refuser", settings: "Paramètres d'analyse", details: "Confidentialité"
    }
  };

  function getStored(k, storage) { try { return storage.getItem(k); } catch (_) { return null; } }
  function saveStored(k, value, storage) { try { storage.setItem(k, value); } catch (_) {} }
  function removeStored(k, storage) { try { storage.removeItem(k); } catch (_) {} }

  function sessionId() {
    var current = getStored(sessionKey, sessionStorage);
    if (current && /^[a-z0-9-]{16,40}$/i.test(current)) return current;
    if (!crypto || !crypto.getRandomValues) return "";
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    current = Array.from(bytes, function(b){ return b.toString(16).padStart(2, "0"); }).join("");
    saveStored(sessionKey, current, sessionStorage);
    return current;
  }

  function deviceType() {
    var ua = navigator.userAgent || "";
    if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
    if (/Mobi|iPhone|Android/i.test(ua)) return "mobile";
    return "desktop";
  }
  function browserType() {
    var ua = navigator.userAgent || "";
    if (/Edg\//.test(ua)) return "Edge";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return "Other";
  }
  function acquisition() {
    var src = "";
    try { src = new URLSearchParams(location.search).get("utm_source") || ""; } catch (_) {}
    src = src.toLowerCase();
    return ["instagram","linkedin","github","strava"].includes(src) ? src : "";
  }
  function referrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname.slice(0, 100) : ""; }
    catch (_) { return ""; }
  }

  function send(eventType, detail, duration) {
    if (!enabled) return;
    var session = sessionId();
    if (!session) return;
    var payload = {
      site: site,
      event: eventType,
      path: location.pathname.slice(0, 120),
      detail: (detail || "").slice(0, 70),
      session: session,
      referrer: referrerHost(),
      source: acquisition(),
      device: deviceType(),
      browser: browserType(),
      duration: Math.max(0, Math.min(1800, Math.round(duration || 0)))
    };
    var body = JSON.stringify(payload);
    var opts = {method: "POST", mode: "cors", credentials: "omit", keepalive: true,
      headers: {"Content-Type": "text/plain;charset=UTF-8"}, body: body};
    // No response data is needed. sendBeacon is preferable when the tab is closing.
    if (eventType === "engagement" && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(endpoint.href, new Blob([body], {type:"text/plain"}))) return;
      } catch (_) {}
    }
    fetch(endpoint.href, opts).catch(function(){});
  }

  function labelForLink(link) {
    var u;
    try { u = new URL(link.href, location.href); } catch (_) { return "other"; }
    if (u.protocol === "mailto:") return "contact";
    if (u.hostname === "github.com") {
      var segments = u.pathname.split("/").filter(Boolean);
      var repo = segments.length > 1 && segments[0].toLowerCase() === "jonasbader7" ? segments[1] : "";
      var allowed = ["BORS","SplitMate","Portfoliopage","freddy-entrepreneurship-2024","life-expectancy-analysis-r","bfh-digital-business-projects"];
      return allowed.includes(repo) ? "github:" + repo : "github";
    }
    if (u.pathname === "/BORS/" || u.pathname.startsWith("/BORS/")) return "bors-demo";
    if (u.hostname === "www.strava.com" || u.hostname === "strava.com") return "strava";
    if (u.hostname === location.hostname) return "internal";
    return "external";
  }

  function onClick(e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (link) { send("link_click", labelForLink(link), 0); return; }
    // BORS only: instrument a small set of explicitly marked navigation controls.
    var marked = e.target.closest && e.target.closest("[data-analytics-event]");
    if (marked) {
      var category = marked.getAttribute("data-analytics-event") || "";
      if (/^(tab|view|demo):[a-z0-9_-]{1,35}$/.test(category)) send("feature_click", category, 0);
    }
  }
  function flushEngagement() {
    if (!enabled || !foregroundFrom) return;
    var seconds = (performance.now() - foregroundFrom) / 1000;
    foregroundFrom = 0;
    if (seconds >= 3) send("engagement", "", seconds);
  }
  function onVisibility() {
    if (document.visibilityState === "hidden") flushEngagement();
    else if (enabled) foregroundFrom = performance.now();
  }
  function begin() {
    if (started) { enabled = true; foregroundFrom = performance.now(); return; }
    started = true;
    enabled = true;
    foregroundFrom = performance.now();
    send("pageview", "", 0);
    document.addEventListener("click", onClick, {capture:true, passive:true});
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushEngagement);
  }
  function stop() {
    enabled = false;
    foregroundFrom = 0;
    removeStored(sessionKey, sessionStorage);
  }

  function makeButton(text, handler, primary) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = "border:1px solid #88a6a5;border-radius:6px;padding:9px 13px;cursor:pointer;font:inherit;"+
      (primary ? "background:#d4eada;color:#102624;" : "background:transparent;color:#f5faf9;");
    b.addEventListener("click", handler);
    return b;
  }
  function showConsent() {
    if (banner) banner.remove();
    var t = labels[language()];
    banner = document.createElement("section");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", t.heading);
    banner.style.cssText = "position:fixed;bottom:14px;left:14px;z-index:2147483000;max-width:min(490px,calc(100vw - 28px));"+
      "padding:16px 18px;border-radius:12px;background:#122d31;color:#f5faf9;box-shadow:0 8px 36px #0008;"+
      "font:14px/1.45 system-ui,Arial,sans-serif;box-sizing:border-box;";
    var head = document.createElement("strong");
    head.textContent = t.heading;
    head.style.cssText = "display:block;font-size:16px;margin-bottom:7px;";
    var p = document.createElement("p");
    p.textContent = t.body;
    p.style.cssText = "margin:0 0 11px;";
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
    var details = document.createElement("a");
    details.href = "https://jonasbader7.github.io/Portfoliopage/analytics/datenschutz.html";
    details.target = "_blank";
    details.rel = "noopener noreferrer";
    details.textContent = t.details;
    details.style.cssText = "color:#b3e2d4;text-decoration:underline;margin-left:4px;";
    function decide(value) {
      saveStored(key, value, localStorage);
      banner.remove(); banner = null;
      if (value === "yes") begin(); else stop();
    }
    row.append(makeButton(t.no, function(){ decide("no"); }, false));
    row.append(makeButton(t.yes, function(){ decide("yes"); }, true));
    row.append(details);
    banner.append(head, p, row);
    document.body.appendChild(banner);
  }
  function initUI() {
    var t = labels[language()];
    var settings = document.createElement("button");
    settings.type = "button";
    settings.textContent = t.settings;
    settings.style.cssText = "position:fixed;right:10px;bottom:8px;z-index:2147482000;"+
      "padding:4px 8px;border:1px solid #647f80;border-radius:5px;"+
      "background:#122d31;color:#f5faf9;font:11px system-ui,Arial;opacity:.86;cursor:pointer";
    settings.addEventListener("click", showConsent);
    document.body.appendChild(settings);
    var chosen = getStored(key, localStorage);
    if (chosen === "yes") begin();
    else if (chosen !== "no") showConsent();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUI, {once:true});
  else initUI();
})();
