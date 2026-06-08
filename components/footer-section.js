// NeoMind footer — minimal product footer with legal hooks.
// "Powered by Neomeric Pty Ltd" legal attribution line.
// Mounted via DOMParser to avoid runtime innerHTML.

class FooterSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  _getLocale() {
    const locales = window.NM_LOCALES || {};
    const code = this.getAttribute("data-locale") || "intl";
    return locales[code] || locales["intl"] || { code: "intl", path: "/", footerTagline: "Measurable AI employees that do the real work." };
  }

  connectedCallback() {
    const L = this._getLocale();
    const entity = (window.NM_LOCALES && window.NM_LOCALES.entity) || { legalName: "Neomeric Pty Ltd", product: "NeoMind", founded: "2015" };

    // Legal pages are root-only; all locales link to /privacy.html etc.
    const legalBase = "/";

    // Company-column base: every locale (intl / au / es) now has its own
    // company/customers/contact pages under its locale path, so all use L.path.
    const companyBase = L.path;

    // Footer column headings + link labels resolve from the locale; English
    // fallback keeps intl working if the locale table fails to load.
    const f = Object.assign(
      { product:"Product", company:"Company", account:"Account", legal:"Legal",
        measurable:"Measurable", roster:"Roster", brain:"The Brain", integrations:"Integrations", pricing:"Pricing", compare:"Compare", resources:"Resources", faq:"FAQ",
        about:"About", customers:"Customers", contact:"Contact",
        startTrial:"Start free trial", signIn:"Sign in", support:"Support",
        privacy:"Privacy", terms:"Terms", fairUse:"Fair use", cookieSettings:"Cookie settings" },
      L.footerLabels || {}
    );

    // Hosting note — three-way: au gets sovereignty badge, es gets localised line, intl gets quiet English note
    const auNote = L.code === "au"
      ? "<p class=\"au-note\">Hosted in Sydney, Australia. Your data never leaves Australia. Privacy Act 1988 aligned.</p>"
      : L.code === "es"
        ? "<p class=\"intl-note\">" + L.hostingLine + "</p>"
        : "<p class=\"intl-note\">" + L.hostingLine + "</p>";

    const markup =
      "<style>" + STYLES + "</style>" +
      "<footer><div class=\"container\">" +
      "<div class=\"grid\">" +
      "<div class=\"brand-col\">" +
      "<div class=\"wordmark\">NeoMind</div>" +
      "<p class=\"tagline\">" + L.footerTagline + "</p>" +
      auNote +
      "</div>" +
      "<div><h4>" + f.product + "</h4><ul>" +
      "<li><a href=\"" + L.path + "#measurable\">" + f.measurable + "</a></li>" +
      "<li><a href=\"" + L.path + "#roster\">" + f.roster + "</a></li>" +
      "<li><a href=\"" + L.path + "#brain\">" + f.brain + "</a></li>" +
      "<li><a href=\"" + L.path + "#integrations\">" + f.integrations + "</a></li>" +
      "<li><a href=\"" + L.path + "#pricing\">" + f.pricing + "</a></li>" +
      // Compare + Resources are locale-prefixed; all locales (intl / au / es)
      // now have their full hubs, so these render for every market.
      "<li><a href=\"" + L.path + "compare/\">" + f.compare + "</a></li>" +
      "<li><a href=\"" + L.path + "resources/\">" + f.resources + "</a></li>" +
      "<li><a href=\"" + L.path + "#faq\">" + f.faq + "</a></li>" +
      "</ul></div>" +
      // Company links are locale-prefixed via companyBase so au resolves to
      // /au/company/, /au/customers/, /au/contact/ (those AU twins exist); intl
      // to /company/ etc.; es falls back to the root pages.
      "<div><h4>" + f.company + "</h4><ul>" +
      "<li><a href=\"" + companyBase + "company/\">" + f.about + "</a></li>" +
      "<li><a href=\"" + companyBase + "customers/\">" + f.customers + "</a></li>" +
      "<li><a href=\"" + companyBase + "contact/\">" + f.contact + "</a></li>" +
      "</ul></div>" +
      "<div><h4>" + f.account + "</h4><ul>" +
      "<li><a href=\"https://app.neomindhub.com/signup\">" + f.startTrial + "</a></li>" +
      "<li><a href=\"https://app.neomindhub.com/login\">" + f.signIn + "</a></li>" +
      "<li><a href=\"mailto:support@neomeric.com\">" + f.support + "</a></li>" +
      "</ul></div>" +
      "<div><h4>" + f.legal + "</h4><ul>" +
      "<li><a href=\"" + legalBase + "privacy.html\">" + f.privacy + "</a></li>" +
      "<li><a href=\"" + legalBase + "terms.html\">" + f.terms + "</a></li>" +
      "<li><a href=\"" + legalBase + "fair-use.html\">" + f.fairUse + "</a></li>" +
      "<li><a href=\"#\" class=\"cookie-settings\">" + f.cookieSettings + "</a></li>" +
      "</ul></div>" +
      "</div>" +
      "<div class=\"bottom\"><p>&copy; " + entity.legalName + " &middot; " + entity.product + " &middot; since " + entity.founded + (L.code === "au" ? " &middot; Melbourne, Australia." : ".") + "</p></div>" +
      "</div></footer>";

    const parsed = new DOMParser().parseFromString(markup, "text/html");
    while (parsed.head.firstChild) this.shadowRoot.appendChild(parsed.head.firstChild);
    while (parsed.body.firstChild) this.shadowRoot.appendChild(parsed.body.firstChild);

    // "Cookie settings" reopens the consent banner (js/cookie-consent.js).
    const cookieLink = this.shadowRoot.querySelector(".cookie-settings");
    if (cookieLink) {
      cookieLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.nmOpenCookieSettings === "function") window.nmOpenCookieSettings();
      });
    }
  }
}

const STYLES = [
  ":host { display: block; border-top: 1px solid rgba(0, 0, 0, 0.08); background: #f8f9fb; padding: 64px 0 32px; margin-top: 80px; font-family: 'Kanit', sans-serif; }",
  "@media (prefers-color-scheme: dark) { :host { background: #0f1623; border-top-color: rgba(255,255,255,0.08); } }",
  ".container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }",
  ".grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 48px; border-bottom: 1px solid rgba(0, 0, 0, 0.08); }",
  "@media (max-width: 1024px) { .grid { grid-template-columns: 1fr 1fr 1fr; } .brand-col { grid-column: span 3; } }",
  "@media (prefers-color-scheme: dark) { .grid { border-bottom-color: rgba(255,255,255,0.08); } }",
  ".brand-col { max-width: 340px; }",
  ".wordmark { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px; background: linear-gradient(135deg, #9C7DB9, #007BFF, #00D1B2); -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: -0.015em; margin-bottom: 12px; }",
  ".tagline { font-size: 14px; line-height: 1.55; color: #6b7280; margin: 0 0 8px; }",
  "@media (prefers-color-scheme: dark) { .tagline { color: #9ca3af; } }",
  ".au-note { font-size: 12.5px; line-height: 1.5; color: #374151; font-weight: 500; margin: 0; padding: 8px 10px; background: rgba(0,209,178,0.06); border-left: 2px solid #00D1B2; border-radius: 0 6px 6px 0; }",
  "@media (prefers-color-scheme: dark) { .au-note { color: #d1fae5; background: rgba(0,209,178,0.1); } }",
  ".intl-note { font-size: 12px; line-height: 1.5; color: #9ca3af; margin: 0; }",
  "@media (prefers-color-scheme: dark) { .intl-note { color: #6b7280; } }",
  "h4 { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #111827; margin: 0 0 16px; }",
  "@media (prefers-color-scheme: dark) { h4 { color: #f3f4f6; } }",
  "ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }",
  "ul a { font-size: 14px; color: #6b7280; text-decoration: none; transition: color 0.2s ease; }",
  "@media (prefers-color-scheme: dark) { ul a { color: #9ca3af; } }",
  "ul a:hover { color: #111827; }",
  "@media (prefers-color-scheme: dark) { ul a:hover { color: #f3f4f6; } }",
  ".bottom { padding-top: 24px; font-size: 13px; color: #6b7280; }",
  "@media (prefers-color-scheme: dark) { .bottom { color: #9ca3af; } }",
  ".bottom p { margin: 0; }",
  "@media (max-width: 768px) { .grid { grid-template-columns: 1fr 1fr; gap: 32px 24px; } .brand-col { grid-column: span 2; } }",
].join("\n");

customElements.define("footer-section", FooterSection);
