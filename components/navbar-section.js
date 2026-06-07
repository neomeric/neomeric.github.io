// NeoMind navbar — sticky pill, product-only brand.
// Mounted via DOMParser to avoid runtime innerHTML (per shadow-DOM safety rule).

class NavbarSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.syncTheme();
    const observer = new MutationObserver(() => this.syncTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  syncTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    this.classList.toggle("dark", isDark);
  }

  _getLocale() {
    const locales = window.NM_LOCALES || {};
    const code = this.getAttribute("data-locale") || "intl";
    return locales[code] || locales["intl"] || { code: "intl", path: "/", switcherLabel: "International (USD)" };
  }

  render() {
    const L = this._getLocale();
    const locales = window.NM_LOCALES || {};

    // Nav menu/CTA labels resolve from the locale; English fallback keeps
    // intl working if the locale table fails to load.
    const nav = Object.assign(
      { product:"How it works", measurable:"Measurable", roster:"Roster", brain:"The Brain", integrations:"Integrations", pricing:"Pricing", compare:"Compare", resources:"Resources", faq:"FAQ", signIn:"Sign in", startFree:"Start free",
        platform:"Platform", employees:"AI Employees", solutions:"Solutions", company:"Company" },
      L.navLabels || {}
    );

    // Build switcher options string safely — no interpolation of user data
    // (switcherLabels come from our own controlled locales object)
    const optionStrings = ["intl", "au", "es"].map(function(code) {
      const loc = locales[code];
      if (!loc) return "";
      const selected = code === L.code ? " selected=\"selected\"" : "";
      return "<option value=\"" + code + "\"" + selected + ">" + loc.switcherLabel + "</option>";
    }).join("");

    // Nav links. intl now routes to dedicated hub PAGES (the full content build
    // landed): Platform / AI Employees / Solutions / Pricing / Resources / Company,
    // each an absolute page link (no #anchors). Compare folds under Resources.
    // au/es keep their existing scroll-anchor + gated-hub behaviour unchanged,
    // because their localized hub pages don't exist yet. The same link set drives
    // both the desktop ul and the mobile panel.
    let navItems;
    if (L.code === "intl") {
      navItems =
        "<li><a href=\"/platform/\">" + nav.platform + "</a></li>" +
        "<li><a href=\"/employees/\">" + nav.employees + "</a></li>" +
        "<li><a href=\"/solutions/\">" + nav.solutions + "</a></li>" +
        "<li><a href=\"/pricing/\">" + nav.pricing + "</a></li>" +
        "<li><a href=\"/resources/\">" + nav.resources + "</a></li>" +
        "<li><a href=\"/company/\">" + nav.company + "</a></li>";
    } else {
      const gated = (L.code === "au");
      const gatedLinks = gated
        ? "<li><a href=\"" + L.path + "resources/\">" + nav.resources + "</a></li>" +
          "<li><a href=\"" + L.path + "compare/\">" + nav.compare + "</a></li>"
        : "";
      navItems =
        "<li><a href=\"" + L.path + "#measurable\">" + nav.product + "</a></li>" +
        "<li><a href=\"" + L.path + "#pricing\">" + nav.pricing + "</a></li>" +
        gatedLinks;
    }

    const markup =
      "<style>" + STYLES + "</style>" +
      "<nav class=\"inner\" aria-label=\"Primary\">" +
      "<a href=\"" + L.path + "\" class=\"brand\" aria-label=\"NeoMind home\">NeoMind</a>" +
      "<ul>" + navItems + "</ul>" +
      "<div class=\"cta\">" +
      "<select class=\"switcher\" aria-label=\"Choose your region\">" + optionStrings + "</select>" +
      "<a href=\"https://app.neomindhub.com/login\" class=\"signin\">" + nav.signIn + "</a>" +
      "<a href=\"https://app.neomindhub.com/signup\" class=\"trial\">" + nav.startFree + "</a>" +
      "<button class=\"menu-toggle\" type=\"button\" aria-label=\"Open menu\" aria-expanded=\"false\" aria-controls=\"nm-mobile-panel\">" +
      "<span class=\"bar\"></span><span class=\"bar\"></span><span class=\"bar\"></span>" +
      "</button>" +
      "</div>" +
      "</nav>" +
      "<div class=\"mobile-panel\" id=\"nm-mobile-panel\" hidden>" +
      "<ul class=\"mobile-links\">" + navItems + "</ul>" +
      "<div class=\"mobile-cta\">" +
      "<a href=\"https://app.neomindhub.com/login\" class=\"m-signin\">" + nav.signIn + "</a>" +
      "<a href=\"https://app.neomindhub.com/signup\" class=\"m-trial\">" + nav.startFree + "</a>" +
      "</div>" +
      "<div class=\"mobile-region\">" +
      "<label class=\"mobile-region-label\" for=\"nm-mobile-switcher\">Region</label>" +
      "<select class=\"switcher mobile-switcher\" id=\"nm-mobile-switcher\" aria-label=\"Choose your region\">" + optionStrings + "</select>" +
      "</div>" +
      "</div>";

    const parsed = new DOMParser().parseFromString(markup, "text/html");
    while (parsed.head.firstChild) this.shadowRoot.appendChild(parsed.head.firstChild);
    while (parsed.body.firstChild) this.shadowRoot.appendChild(parsed.body.firstChild);

    // Wire ALL switchers (desktop in .cta + mobile in panel): on change set cookie + navigate
    const switchers = this.shadowRoot.querySelectorAll(".switcher");
    switchers.forEach(function(select) {
      select.addEventListener("change", function() {
        const code = select.value;
        const target = (window.NM_LOCALES && window.NM_LOCALES[code]) || null;
        if (!target) return;
        document.cookie = "nm_locale=" + code + ";path=/;max-age=31536000;SameSite=Lax";
        window.location.href = target.path;
      });
    });

    this._wireMobileMenu();
  }

  _wireMobileMenu() {
    const root = this.shadowRoot;
    const toggle = root.querySelector(".menu-toggle");
    const panel = root.querySelector(".mobile-panel");
    if (!toggle || !panel) return;

    const self = this;
    const setOpen = function(open) {
      panel.hidden = !open;
      panel.classList.toggle("open", open);
      toggle.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    toggle.addEventListener("click", function(e) {
      e.stopPropagation();
      setOpen(panel.hidden);
    });

    // Close on link click within the panel
    panel.querySelectorAll("a").forEach(function(a) {
      a.addEventListener("click", function() { setOpen(false); });
    });

    // Close on Escape
    this._onKeydown = function(e) {
      if (e.key === "Escape" && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    };
    document.addEventListener("keydown", this._onKeydown);

    // Close on outside click (clicks land on the host from light DOM)
    this._onDocClick = function(e) {
      if (panel.hidden) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(self) === -1) setOpen(false);
    };
    document.addEventListener("click", this._onDocClick);
  }

  disconnectedCallback() {
    if (this._onKeydown) document.removeEventListener("keydown", this._onKeydown);
    if (this._onDocClick) document.removeEventListener("click", this._onDocClick);
  }
}

const STYLES = [
  ":host { position: sticky; top: 16px; z-index: 50; display: flex; justify-content: center; pointer-events: none; padding: 0 16px; margin-top: 16px; }",
  ".inner { pointer-events: auto; display: flex; align-items: center; gap: 32px; padding: 10px 14px 10px 20px; border-radius: 999px; background: rgba(255, 255, 255, 0.78); backdrop-filter: saturate(140%) blur(16px); -webkit-backdrop-filter: saturate(140%) blur(16px); border: 1px solid rgba(0, 0, 0, 0.06); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.05); max-width: 1100px; width: 100%; }",
  ":host(.dark) .inner { background: rgba(15, 22, 35, 0.7); border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4); }",
  ".brand { text-decoration: none; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; background: linear-gradient(135deg, #9C7DB9, #007BFF, #00D1B2); -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: -0.01em; white-space: nowrap; }",
  "ul { display: flex; gap: 22px; list-style: none; margin: 0; padding: 0; flex: 1; justify-content: center; }",
  "ul a { font-family: 'Kanit', sans-serif; font-size: 14px; font-weight: 500; color: #6b7280; text-decoration: none; transition: color 0.2s ease; }",
  ":host(.dark) ul a { color: #9ca3af; }",
  "ul a:hover { color: #111827; }",
  ":host(.dark) ul a:hover { color: #f3f4f6; }",
  ".cta { display: flex; align-items: center; gap: 10px; }",
  ".switcher { font-family: 'Kanit', sans-serif; font-size: 13px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid rgba(0,0,0,0.12); border-radius: 999px; padding: 5px 10px; cursor: pointer; appearance: auto; -webkit-appearance: auto; transition: border-color 0.2s ease; }",
  ".switcher:hover { border-color: #9C7DB9; color: #111827; }",
  ":host(.dark) .switcher { color: #9ca3af; border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }",
  ":host(.dark) .switcher:hover { border-color: #9C7DB9; color: #f3f4f6; }",
  ".signin { font-family: 'Kanit', sans-serif; font-size: 14px; font-weight: 500; color: #6b7280; text-decoration: none; padding: 8px 4px; }",
  ":host(.dark) .signin { color: #9ca3af; }",
  ".signin:hover { color: #111827; }",
  ":host(.dark) .signin:hover { color: #f3f4f6; }",
  ".trial { font-family: 'Kanit', sans-serif; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 600; color: white; background: linear-gradient(135deg, #9C7DB9, #007BFF); text-decoration: none; transition: transform 0.15s ease, box-shadow 0.15s ease; }",
  ".trial:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,123,255,0.3); }",

  // Hamburger toggle — hidden on desktop, shown at <=768px
  ".menu-toggle { display: none; align-items: center; justify-content: center; flex-direction: column; gap: 4px; width: 38px; height: 38px; padding: 0; border: 1px solid rgba(0,0,0,0.10); border-radius: 999px; background: transparent; cursor: pointer; transition: border-color 0.2s ease; }",
  ".menu-toggle:hover { border-color: #9C7DB9; }",
  ".menu-toggle:focus-visible { outline: 2px solid #007BFF; outline-offset: 2px; }",
  ".menu-toggle .bar { display: block; width: 18px; height: 2px; border-radius: 2px; background: #374151; transition: transform 0.2s ease, opacity 0.2s ease; }",
  ":host(.dark) .menu-toggle { border-color: rgba(255,255,255,0.15); }",
  ":host(.dark) .menu-toggle .bar { background: #e5e7eb; }",
  ".menu-toggle.active .bar:nth-child(1) { transform: translateY(6px) rotate(45deg); }",
  ".menu-toggle.active .bar:nth-child(2) { opacity: 0; }",
  ".menu-toggle.active .bar:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }",

  // Mobile panel — glass card dropping below the pill; hidden on desktop
  ".mobile-panel { display: none; }",
  ".mobile-panel[hidden] { display: none; }",
  ".mobile-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }",
  ".mobile-links li { display: block; }",
  ".mobile-links a { font-family: 'Kanit', sans-serif; display: block; padding: 12px 14px; font-size: 16px; font-weight: 500; color: #374151; text-decoration: none; border-radius: 12px; transition: background 0.15s ease, color 0.15s ease; }",
  ".mobile-links a:hover, .mobile-links a:focus-visible { background: rgba(0,0,0,0.04); color: #111827; outline: none; }",
  ":host(.dark) .mobile-links a { color: #cbd5e1; }",
  ":host(.dark) .mobile-links a:hover, :host(.dark) .mobile-links a:focus-visible { background: rgba(255,255,255,0.06); color: #f3f4f6; }",
  ".mobile-cta { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; padding-top: 14px; border-top: 1px solid rgba(0,0,0,0.08); }",
  ":host(.dark) .mobile-cta { border-top-color: rgba(255,255,255,0.10); }",
  ".m-signin { font-family: 'Kanit', sans-serif; text-align: center; padding: 11px 16px; border-radius: 999px; font-size: 15px; font-weight: 500; color: #374151; text-decoration: none; border: 1px solid rgba(0,0,0,0.12); }",
  ".m-signin:hover { border-color: #9C7DB9; color: #111827; }",
  ":host(.dark) .m-signin { color: #cbd5e1; border-color: rgba(255,255,255,0.15); }",
  ":host(.dark) .m-signin:hover { color: #f3f4f6; border-color: #9C7DB9; }",
  ".m-trial { font-family: 'Kanit', sans-serif; text-align: center; padding: 12px 16px; border-radius: 999px; font-size: 15px; font-weight: 600; color: white; background: linear-gradient(135deg, #9C7DB9, #007BFF); text-decoration: none; }",
  ".m-trial:hover { box-shadow: 0 6px 16px rgba(0,123,255,0.3); }",

  "@media (max-width: 768px) {",
  "  ul { display: none; }",
  "  .inner { gap: 8px; padding: 8px 8px 8px 14px; box-sizing: border-box; max-width: 100%; }",
  "  .signin { display: none; }",
  // Hide the desktop switcher from the crowded mobile bar — it moves into the panel
  "  .cta .switcher { display: none; }",
  "  .brand { flex-shrink: 0; }",
  "  .trial { flex-shrink: 0; white-space: nowrap; }",
  "  .menu-toggle { display: flex; flex-shrink: 0; }",
  "  :host { flex-direction: column; align-items: stretch; }",
  "  .mobile-panel { display: block; pointer-events: auto; margin: 10px auto 0; max-width: 1100px; width: 100%; box-sizing: border-box; padding: 12px; border-radius: 20px; background: rgba(255,255,255,0.78); backdrop-filter: saturate(140%) blur(16px); -webkit-backdrop-filter: saturate(140%) blur(16px); border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 10px 30px rgba(0,0,0,0.08); }",
  "  .mobile-panel[hidden] { display: none; }",
  "  :host(.dark) .mobile-panel { background: rgba(15,22,35,0.7); border-color: rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.45); }",
  // Mobile region row — sits below the mobile-cta block
  "  .mobile-region { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.08); }",
  "  :host(.dark) .mobile-region { border-top-color: rgba(255,255,255,0.10); }",
  "  .mobile-region-label { font-family: 'Kanit', sans-serif; font-size: 13px; font-weight: 500; color: #6b7280; }",
  "  :host(.dark) .mobile-region-label { color: #9ca3af; }",
  "  .mobile-switcher { flex: 1; font-size: 13px; }",
  "}",
].join("\n");

customElements.define("navbar-section", NavbarSection);
