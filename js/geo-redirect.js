// geo-redirect.js — client-side market nudge, bot-safe.
// Bots never run JS so this script only ever executes in real browsers.
// NEVER auto-redirects: only shows a dismissible banner. Humans always win
// over detected locale — cookie preference is the final authority.

(function () {
  'use strict';

  // 1. Read the current locale (set by each page before loading this script)
  var current = window.NM_LOCALE || 'intl';

  // 2. Bot guard — bail immediately if this looks like a non-human agent
  if (navigator.webdriver) return;
  var ua = navigator.userAgent.toLowerCase();
  if (/bot|crawl|spider|gptbot|claudebot|bingbot|googlebot/.test(ua)) return;

  // Helper: read a cookie by name
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? match[1] : null;
  }

  // Helper: set a cookie
  function setCookie(name, value) {
    document.cookie = name + '=' + value + ';path=/;max-age=31536000;SameSite=Lax';
  }

  // Helper: build a dismissible banner safely (createElement/textContent — no innerHTML)
  function showBanner(message, acceptLabel, acceptPath, onAccept, onDismiss) {
    var locales = window.NM_LOCALES || {};

    var bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:9999',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:12px',
      'flex-wrap:wrap',
      'padding:12px 20px',
      'background:rgba(15,22,35,0.92)',
      'color:#f3f4f6',
      'font-family:Kanit,sans-serif',
      'font-size:14px',
      'line-height:1.4',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'border-top:1px solid rgba(255,255,255,0.1)',
      'box-shadow:0 -4px 24px rgba(0,0,0,0.3)',
    ].join(';');

    var text = document.createElement('span');
    text.textContent = message;
    bar.appendChild(text);

    if (acceptLabel && acceptPath) {
      var go = document.createElement('a');
      go.href = acceptPath;
      go.textContent = acceptLabel;
      go.style.cssText = 'padding:6px 14px;border-radius:999px;background:linear-gradient(135deg,#9C7DB9,#007BFF);color:white;text-decoration:none;font-weight:600;font-size:13px;white-space:nowrap;';
      go.addEventListener('click', function () {
        onAccept && onAccept();
        document.body.removeChild(bar);
      });
      bar.appendChild(go);
    }

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = '×'; // ×
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.2);color:#9ca3af;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;';
    dismiss.addEventListener('click', function () {
      onDismiss && onDismiss();
      document.body.removeChild(bar);
    });
    bar.appendChild(dismiss);

    document.body.appendChild(bar);
  }

  // 3. Read stored cookie preference
  var cookieVal = getCookie('nm_locale');

  // Cookie is set — human already made a choice; it always wins.
  // If they're on a different locale than their preference, offer a link — never force.
  if (cookieVal) {
    if (cookieVal !== current) {
      var preferred = window.NM_LOCALES && window.NM_LOCALES[cookieVal];
      if (preferred) {
        var label = preferred.switcherLabel || cookieVal;
        showBanner(
          'You usually use the ' + label + ' site — go there?',
          'Go there',
          preferred.path,
          null, // no extra action on accept — navigation handles it
          null  // dismiss: just close (cookie already set)
        );
      }
    }
    return; // Stop — cookie preference handled
  }

  // 4. No cookie. Only nudge from intl — never nudge from /au/ or /es/.
  if (current !== 'intl') return;

  // Derive target from timezone + language
  var tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (_) {}

  var target = 'intl';
  if (/^Australia\//i.test(tz)) {
    target = 'au';
  } else if (/^Europe\/Madrid$/i.test(tz) || (navigator.language && navigator.language.toLowerCase().indexOf('es') === 0)) {
    target = 'es';
  }

  // Don't nudge if detection says stay on intl
  if (target === 'intl') return;

  var targetLocale = window.NM_LOCALES && window.NM_LOCALES[target];
  if (!targetLocale) return;

  var switcherLabel = targetLocale.switcherLabel || target;

  showBanner(
    'It looks like you might prefer the ' + switcherLabel + ' site.',
    'Switch',
    targetLocale.path,
    function () {
      // Accept: set cookie and let the <a href> navigate
      setCookie('nm_locale', target);
    },
    function () {
      // Dismiss: remember they want intl so they are never nudged again
      setCookie('nm_locale', 'intl');
    }
  );
})();
