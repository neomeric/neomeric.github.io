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
      { measurable:"Measurable", roster:"Roster", brain:"The Brain", integrations:"Integrations", pricing:"Pricing", compare:"Compare", resources:"Resources", faq:"FAQ", signIn:"Sign in", startFree:"Start free" },
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

    const markup =
      "<style>" + STYLES + "</style>" +
      "<nav class=\"inner\" aria-label=\"Primary\">" +
      "<a href=\"" + L.path + "\" class=\"brand\" aria-label=\"NeoMind home\">NeoMind</a>" +
      "<ul>" +
      "<li><a href=\"" + L.path + "#measurable\">" + nav.measurable + "</a></li>" +
      "<li><a href=\"" + L.path + "#roster\">" + nav.roster + "</a></li>" +
      "<li><a href=\"" + L.path + "#brain\">" + nav.brain + "</a></li>" +
      "<li><a href=\"" + L.path + "#integrations\">" + nav.integrations + "</a></li>" +
      "<li><a href=\"" + L.path + "#pricing\">" + nav.pricing + "</a></li>" +
      // Compare + Resources are locale-prefixed, rendered for locales whose hubs
      // exist today (intl + au). es stays hidden until its content pass ships.
      (L.code === "intl" || L.code === "au"
        ? "<li><a href=\"" + L.path + "compare/\">" + nav.compare + "</a></li>" +
          "<li><a href=\"" + L.path + "resources/\">" + nav.resources + "</a></li>"
        : "") +
      "<li><a href=\"" + L.path + "#faq\">" + nav.faq + "</a></li>" +
      "</ul>" +
      "<div class=\"cta\">" +
      "<select class=\"switcher\" aria-label=\"Choose your region\">" + optionStrings + "</select>" +
      "<a href=\"https://app.neomindhub.com/login\" class=\"signin\">" + nav.signIn + "</a>" +
      "<a href=\"https://app.neomindhub.com/signup\" class=\"trial\">" + nav.startFree + "</a>" +
      "</div>" +
      "</nav>";

    const parsed = new DOMParser().parseFromString(markup, "text/html");
    while (parsed.head.firstChild) this.shadowRoot.appendChild(parsed.head.firstChild);
    while (parsed.body.firstChild) this.shadowRoot.appendChild(parsed.body.firstChild);

    // Wire switcher: on change set cookie + navigate
    const select = this.shadowRoot.querySelector(".switcher");
    if (select) {
      select.addEventListener("change", function() {
        const code = select.value;
        const target = (window.NM_LOCALES && window.NM_LOCALES[code]) || null;
        if (!target) return;
        document.cookie = "nm_locale=" + code + ";path=/;max-age=31536000;SameSite=Lax";
        window.location.href = target.path;
      });
    }
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
  "@media (max-width: 768px) { ul { display: none; } .inner { gap: 12px; padding: 8px 8px 8px 16px; } .signin { display: none; } .switcher { font-size: 12px; padding: 4px 8px; } }",
].join("\n");

customElements.define("navbar-section", NavbarSection);
