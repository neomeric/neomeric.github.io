// NeoMind — GDPR/privacy cookie consent banner + Google Consent Mode v2 bridge.
//
// Pairs with the inline Consent Mode v2 *default* block in each page <head>
// (which runs BEFORE GTM and denies ad/analytics storage until consent).
// This file renders the consent UI and, on a choice, persists `nm_consent`
// and calls gtag('consent','update', ...) so GTM picks up the granted state.
//
// Built in LIGHT DOM (document.body) so it overlays everything (above the nav).
// Markup is constructed with createElement/textContent — no untrusted
// interpolation, no innerHTML.

(function () {
  "use strict";

  var COOKIE_NAME = "nm_consent";
  var MAX_AGE = 15552000; // 180 days, in seconds
  var BANNER_ID = "nm-cookie-consent";

  // ---- i18n -------------------------------------------------------------
  // Banner copy is keyed off window.NM_LOCALE (set per page before this loads).
  // intl + au stay English; es renders Spanish. The link target (/privacy.html)
  // is shared across locales — legal pages are root-only.
  var COPY = {
    en: {
      ariaLabel: "Cookie consent",
      noticeBefore: "We use cookies to understand how the site is used and improve it. See our ",
      privacyLink: "Privacy Policy",
      noticeAfter: ".",
      accept: "Accept",
      decline: "Decline"
    },
    es: {
      ariaLabel: "Consentimiento de cookies",
      noticeBefore: "Usamos cookies para entender cómo se usa el sitio y mejorarlo. Consulta nuestra ",
      privacyLink: "Política de privacidad",
      noticeAfter: ".",
      accept: "Aceptar",
      decline: "Rechazar"
    }
  };

  function getCopy() {
    var locale = window.NM_LOCALE;
    return (locale && COPY[locale]) ? COPY[locale] : COPY.en;
  }

  // ---- gtag bridge ------------------------------------------------------
  // The <head> default block defines window.gtag + dataLayer. Fall back to a
  // safe shim so a missing/blocked GTM never throws.
  function gtag() {
    if (typeof window.gtag === "function") {
      window.gtag.apply(window, arguments);
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  // ---- cookie helpers ---------------------------------------------------
  function readConsent() {
    var m = document.cookie.match(/(?:^|; )nm_consent=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function writeConsent(value) {
    document.cookie =
      COOKIE_NAME + "=" + encodeURIComponent(value) +
      "; path=/; max-age=" + MAX_AGE + "; SameSite=Lax";
  }

  // ---- consent application ---------------------------------------------
  function applyGranted() {
    gtag("consent", "update", {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    });
  }

  function accept() {
    writeConsent("granted");
    applyGranted();
    removeBanner();
  }

  function decline() {
    writeConsent("denied");
    // Consent stays denied (the head default already denied); nothing to update.
    removeBanner();
  }

  // ---- styles -----------------------------------------------------------
  // Scoped via the #nm-cookie-consent id so nothing leaks into the page.
  // Light + dark mode: dark applies when <html> carries .dark / [data-theme="dark"]
  // (the site's toggle) OR via prefers-color-scheme for first-paint visitors.
  var CSS = [
    "#nm-cookie-consent{",
    "  position:fixed;left:0;right:0;bottom:0;z-index:2147483000;",
    "  display:flex;justify-content:center;pointer-events:none;",
    "  padding:16px;box-sizing:border-box;",
    "  font-family:'Kanit',system-ui,-apple-system,sans-serif;",
    "}",
    "#nm-cookie-consent *{box-sizing:border-box;}",
    "#nm-cookie-consent .nm-cc-card{",
    "  pointer-events:auto;width:100%;max-width:640px;",
    "  display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px;",
    "  padding:18px 20px;border-radius:18px;",
    "  background:rgba(255,255,255,0.86);",
    "  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);",
    "  border:1px solid rgba(17,24,39,0.10);",
    "  box-shadow:0 24px 48px rgba(17,24,39,0.16);",
    "  animation:nm-cc-rise .32s cubic-bezier(.16,1,.3,1) both;",
    "}",
    "#nm-cookie-consent .nm-cc-text{",
    "  flex:1 1 280px;min-width:0;",
    "  font-size:13.5px;line-height:1.55;color:#374151;margin:0;",
    "}",
    "#nm-cookie-consent .nm-cc-text a{color:#007BFF;text-decoration:underline;font-weight:500;}",
    "#nm-cookie-consent .nm-cc-actions{",
    "  flex:0 0 auto;display:flex;gap:10px;margin-left:auto;",
    "}",
    "#nm-cookie-consent button{",
    "  font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;",
    "  padding:10px 20px;border-radius:9999px;border:1px solid transparent;",
    "  transition:transform .15s ease,box-shadow .15s ease,background .15s ease;",
    "  white-space:nowrap;",
    "}",
    "#nm-cookie-consent button:focus-visible{outline:2px solid #007BFF;outline-offset:2px;}",
    "#nm-cookie-consent .nm-cc-decline{",
    "  background:transparent;color:#4b5563;border-color:rgba(17,24,39,0.16);",
    "}",
    "#nm-cookie-consent .nm-cc-decline:hover{background:rgba(17,24,39,0.04);}",
    "#nm-cookie-consent .nm-cc-accept{",
    "  color:#fff;border:0;",
    "  background:linear-gradient(135deg,#007BFF 0%,#00D1B2 100%);",
    "  box-shadow:0 10px 24px -8px rgba(0,123,255,0.55);",
    "}",
    "#nm-cookie-consent .nm-cc-accept:hover{transform:translateY(-1px);box-shadow:0 14px 28px -8px rgba(0,123,255,0.6);}",
    "@keyframes nm-cc-rise{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}",
    "@media (max-width:520px){",
    "  #nm-cookie-consent{padding:12px;}",
    "  #nm-cookie-consent .nm-cc-card{flex-direction:column;align-items:stretch;gap:14px;padding:16px;border-radius:16px;}",
    "  #nm-cookie-consent .nm-cc-actions{margin-left:0;}",
    "  #nm-cookie-consent .nm-cc-actions button{flex:1 1 0;}",
    "}",
    // Dark mode — site toggle (.dark / [data-theme="dark"]) takes priority.
    "html.dark #nm-cookie-consent .nm-cc-card,",
    "[data-theme='dark'] #nm-cookie-consent .nm-cc-card{",
    "  background:rgba(31,41,55,0.88);border-color:rgba(255,255,255,0.10);",
    "  box-shadow:0 24px 48px rgba(0,0,0,0.45);",
    "}",
    "html.dark #nm-cookie-consent .nm-cc-text,",
    "[data-theme='dark'] #nm-cookie-consent .nm-cc-text{color:#d1d5db;}",
    "html.dark #nm-cookie-consent .nm-cc-text a,",
    "[data-theme='dark'] #nm-cookie-consent .nm-cc-text a{color:#33d6bf;}",
    "html.dark #nm-cookie-consent .nm-cc-decline,",
    "[data-theme='dark'] #nm-cookie-consent .nm-cc-decline{color:#d1d5db;border-color:rgba(255,255,255,0.18);}",
    "html.dark #nm-cookie-consent .nm-cc-decline:hover,",
    "[data-theme='dark'] #nm-cookie-consent .nm-cc-decline:hover{background:rgba(255,255,255,0.06);}",
    // Dark mode — OS preference fallback (only when the site hasn't forced light).
    "@media (prefers-color-scheme:dark){",
    "  html:not(.dark):not([data-theme='light']) #nm-cookie-consent .nm-cc-card{",
    "    background:rgba(31,41,55,0.88);border-color:rgba(255,255,255,0.10);box-shadow:0 24px 48px rgba(0,0,0,0.45);",
    "  }",
    "  html:not(.dark):not([data-theme='light']) #nm-cookie-consent .nm-cc-text{color:#d1d5db;}",
    "  html:not(.dark):not([data-theme='light']) #nm-cookie-consent .nm-cc-text a{color:#33d6bf;}",
    "  html:not(.dark):not([data-theme='light']) #nm-cookie-consent .nm-cc-decline{color:#d1d5db;border-color:rgba(255,255,255,0.18);}",
    "}"
  ].join("\n");

  function injectStyles() {
    if (document.getElementById("nm-cc-styles")) return;
    var style = document.createElement("style");
    style.id = "nm-cc-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ---- banner build -----------------------------------------------------
  function buildBanner() {
    var copy = getCopy();

    var wrap = document.createElement("div");
    wrap.id = BANNER_ID;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-live", "polite");
    wrap.setAttribute("aria-label", copy.ariaLabel);

    var card = document.createElement("div");
    card.className = "nm-cc-card";

    var text = document.createElement("p");
    text.className = "nm-cc-text";
    text.appendChild(document.createTextNode(copy.noticeBefore));
    var link = document.createElement("a");
    link.href = "/privacy.html";
    link.textContent = copy.privacyLink;
    text.appendChild(link);
    text.appendChild(document.createTextNode(copy.noticeAfter));

    var actions = document.createElement("div");
    actions.className = "nm-cc-actions";

    var declineBtn = document.createElement("button");
    declineBtn.type = "button";
    declineBtn.className = "nm-cc-decline";
    declineBtn.textContent = copy.decline;
    declineBtn.addEventListener("click", decline);

    var acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "nm-cc-accept";
    acceptBtn.textContent = copy.accept;
    acceptBtn.addEventListener("click", accept);

    actions.appendChild(declineBtn);
    actions.appendChild(acceptBtn);

    card.appendChild(text);
    card.appendChild(actions);
    wrap.appendChild(card);

    return { wrap: wrap, acceptBtn: acceptBtn };
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return; // already shown
    injectStyles();
    var built = buildBanner();
    document.body.appendChild(built.wrap);
    // Move focus to the primary action so keyboard users land on it.
    try { built.acceptBtn.focus({ preventScroll: true }); } catch (e) { built.acceptBtn.focus(); }
  }

  function removeBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ---- public API: reopen from a "Cookie settings" link -----------------
  window.nmOpenCookieSettings = function () {
    showBanner();
  };

  // ---- boot -------------------------------------------------------------
  function init() {
    var existing = readConsent();
    if (existing === "granted" || existing === "denied") {
      // Returning visitor with a saved choice — the head block already
      // re-applied "granted"; never auto-show the banner.
      return;
    }
    showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
