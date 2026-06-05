// ────────────────────────────────────────────────────────────────────
// NeoMind marketing site — page logic
// ────────────────────────────────────────────────────────────────────

// Dark mode persistence
(function () {
    const html = document.documentElement;
    if (localStorage.getItem('darkMode') === 'true') html.classList.add('dark');
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
        btn.addEventListener('click', () => {
            html.classList.toggle('dark');
            localStorage.setItem('darkMode', html.classList.contains('dark'));
        });
    }
})();

// Tab switching (Simon / Maeve / Hugo) — DEMO SECTION ONLY.
// Scoped to #demo so it never touches the hero's own .nm-live-tab /
// .nm-live-panel-content switcher (which has its own handler in index.html).
(function () {
    const demo = document.getElementById('demo');
    if (!demo) return;
    const tabs = demo.querySelectorAll('.tab-btn[data-tab]');
    const panels = demo.querySelectorAll('[data-panel]');
    const eyebrow = document.getElementById('panel-eyebrow');
    const titleEl = document.getElementById('panel-title');
    // Demo tab headers resolve from the active locale; the English literal
    // below stays as the fallback so intl still works if locales fail to load.
    const L = (window.NM_LOCALES && window.NM_LOCALES[window.NM_LOCALE]) || null;
    const META = (L && L.demoMeta) || {
        simon: { eyebrow: 'Live · trained on neomeric.com', title: 'Ask Simon anything about NeoMind' },
        maeve: { eyebrow: 'Live · 90-second voice demo', title: 'Maeve — your AI receptionist' },
        hugo: { eyebrow: 'Preview · staff Q&A · Slack & Teams coming soon', title: 'Hugo — your HR assistant in your Member dashboard' }
    };
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => {
                t.classList.remove('active', 'border-primary', 'text-primary');
                t.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
                t.setAttribute('aria-selected', 'false');
                const icon = t.querySelector('.tab-icon');
                if (icon) {
                    icon.classList.remove('bg-gradient-to-r', 'from-primary', 'to-accent', 'text-white');
                    icon.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-500');
                }
            });
            tab.classList.add('active', 'border-primary', 'text-primary');
            tab.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tab.setAttribute('aria-selected', 'true');
            const activeIcon = tab.querySelector('.tab-icon');
            if (activeIcon) {
                activeIcon.classList.add('bg-gradient-to-r', 'from-primary', 'to-accent', 'text-white');
                activeIcon.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-500');
            }
            panels.forEach(p => p.classList.add('hidden'));
            const sel = '[data-panel="' + target + '"]';
            const active = demo.querySelector(sel);
            if (active) active.classList.remove('hidden');
            if (eyebrow && titleEl && META[target]) {
                eyebrow.textContent = META[target].eyebrow;
                titleEl.textContent = META[target].title;
            }
        });
    });
})();

// ── Simon live demo (real API). Maeve runs as a live voice demo via
//    js/echo-voice.js. Hugo is a static Slack preview.
//
// Auth model (post 2026-05-16): widget key → /v1/sessions → JWT → /v1/chat.
// Widget keys are the public, scope-restricted credential (Stripe-publishable-
// key pattern) — safe to inline in browser JS. The JWT is short-lived (15min)
// and bound to (tenant, agent, scope=chat); it cannot call /v1/sources etc.
const NEOMIND_API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '')
    ? 'http://localhost:8000'
    : 'https://api.neomindhub.com';
const NEOMIND_WIDGET_KEY = 'nm_cf3f44b99d35a00b9ebb57318f12d5b4b5e3d83a9a04ecf4282bf24bf2df0106';
const simonSessionId = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
let simonJwt = null;

async function mintSimonJwt() {
    const r = await fetch(NEOMIND_API + '/v1/sessions', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + NEOMIND_WIDGET_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent: 'simon' })
    });
    if (!r.ok) throw new Error('session_mint_failed_' + r.status);
    const d = await r.json();
    simonJwt = d.token;
    return simonJwt;
}

async function postSimonChat(text) {
    if (!simonJwt) await mintSimonJwt();
    const doFetch = () => fetch(NEOMIND_API + '/v1/chat', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + simonJwt,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent: 'simon', session_id: simonSessionId, message: text })
    });
    let r = await doFetch();
    if (r.status === 401) {
        // JWT expired or server-side rotation — mint a fresh one and retry once.
        await mintSimonJwt();
        r = await doFetch();
    }
    return r;
}

// Streaming variant — opens the SSE `/v1/chat/stream` endpoint and pipes
// tokens through ``onToken`` as they arrive. Cuts perceived latency from
// ~10s (wait for full LLM answer) down to ~1.5s (first token). Honours
// the same JWT-refresh-on-401 retry semantics as postSimonChat.
async function streamSimonChat(text, onToken) {
    if (!simonJwt) await mintSimonJwt();

    const doFetch = () => fetch(NEOMIND_API + '/v1/chat/stream', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + simonJwt,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ agent: 'simon', session_id: simonSessionId, message: text }),
    });

    let r = await doFetch();
    if (r.status === 401) {
        await mintSimonJwt();
        r = await doFetch();
    }
    if (!r.ok || !r.body) {
        throw new Error('stream_failed_' + r.status);
    }

    // Tiny SSE parser. Server emits frames separated by a blank line; each
    // frame is one or more `field: value` lines. We only act on `data:`
    // (raw token text) and `event:` (terminal `done` or named events like
    // `quick_replies`). Everything else is ignored.
    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let eventName = '';
    let dataLines = [];

    const flushFrame = () => {
        if (eventName === 'done') return 'done';
        if (eventName === 'quick_replies') {
            // Drop quick-reply chips for the demo surface (the marketing
            // page doesn't render them); the brain emits them anyway.
            eventName = '';
            dataLines = [];
            return null;
        }
        if (dataLines.length) {
            // Default (unnamed) event = a token frame.
            const token = dataLines.join('\n');
            if (token) onToken(token);
        }
        eventName = '';
        dataLines = [];
        return null;
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, '');
            buffer = buffer.slice(idx + 1);

            if (line === '') {
                // Blank line = end of frame.
                if (flushFrame() === 'done') return;
                continue;
            }
            const colonAt = line.indexOf(':');
            if (colonAt === -1) continue;
            const field = line.slice(0, colonAt);
            // Per SSE spec, the value after `:` has an optional leading space.
            const value = line.slice(colonAt + 1).replace(/^ /, '');
            if (field === 'event') eventName = value;
            else if (field === 'data') dataLines.push(value);
            // `id` / `retry` ignored — no replay support today.
        }
    }
    // Flush any trailing frame (stream may end without a final blank).
    flushFrame();
}

// Pre-clean Markdown that doesn't render in a small chat bubble:
//  - Strip leading #, ##, ### heading markers (keep the heading text, just no marker)
//  - Strip bold markers wrapping a whole heading line so "### **Title**" becomes "Title"
//  - Collapse 3+ consecutive newlines to 2
function preCleanMarkdown(text) {
    return text
        .split('\n')
        .map(line => line.replace(/^\s{0,3}#{1,6}\s+/, ''))   // drop heading markers
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
}

// Build a bubble safely: only **bold**, bullet markers, and \n become elements;
// everything else is rendered as text — no innerHTML on user/API content.
function buildBubble(rawText) {
    const text = preCleanMarkdown(rawText);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Apply inline bold then linebreaks to a string segment
    function appendInline(parent, str) {
        const matches = Array.from(str.matchAll(/\*\*([^*]+)\*\*/g));
        let cursor = 0;
        for (const m of matches) {
            if (m.index > cursor) parent.appendChild(document.createTextNode(str.slice(cursor, m.index)));
            const strong = document.createElement('strong');
            strong.textContent = m[1];
            parent.appendChild(strong);
            cursor = m.index + m[0].length;
        }
        if (cursor < str.length) parent.appendChild(document.createTextNode(str.slice(cursor)));
    }

    // Walk lines: group consecutive `- ` lines into a <ul>
    const lines = text.split('\n');
    let listEl = null;
    let firstNonListSeen = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bulletMatch = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bulletMatch) {
            if (!listEl) {
                listEl = document.createElement('ul');
                listEl.className = 'bubble-ul';
                bubble.appendChild(listEl);
            }
            const li = document.createElement('li');
            appendInline(li, bulletMatch[1]);
            listEl.appendChild(li);
        } else {
            listEl = null;
            if (line.length === 0) {
                if (firstNonListSeen) bubble.appendChild(document.createElement('br'));
            } else {
                if (firstNonListSeen) bubble.appendChild(document.createElement('br'));
                appendInline(bubble, line);
                firstNonListSeen = true;
            }
        }
    }
    return bubble;
}

function appendMsg(mind, role, text) {
    const surface = document.getElementById('chat-' + mind);
    if (!surface) return null;
    const initials = { simon: 'S', maeve: 'M', hugo: 'H' };

    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'bot ' + mind);

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? '👤' : initials[mind];

    const bubble = buildBubble(text);

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    surface.appendChild(wrap);
    surface.scrollTop = surface.scrollHeight;
    return wrap;
}

function appendTyping(mind) {
    const surface = document.getElementById('chat-' + mind);
    if (!surface) return null;
    const initials = { simon: 'S', maeve: 'M', hugo: 'H' };
    const wrap = document.createElement('div');
    wrap.className = 'msg bot ' + mind;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = initials[mind];
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const typing = document.createElement('div');
    typing.className = 'typing';
    for (let i = 0; i < 3; i++) typing.appendChild(document.createElement('span'));
    bubble.appendChild(typing);
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    surface.appendChild(wrap);
    surface.scrollTop = surface.scrollHeight;
    return wrap;
}

async function sendMsg(mind, presetText) {
    const inputEl = document.getElementById('input-' + mind);
    if (!inputEl) return;
    const text = (presetText !== undefined ? presetText : inputEl.value).trim();
    if (!text) return;
    inputEl.value = '';

    appendMsg(mind, 'user', text);
    const typingNode = appendTyping(mind);

    if (mind !== 'simon') {
        // Maeve and Hugo no longer route through here — Maeve is live voice
        // (echo-voice.js), Hugo is a static Slack preview. Bail out quietly.
        if (typingNode) typingNode.remove();
        return;
    }

    // Stream Simon's answer through /v1/chat/stream so visitors see tokens
    // arriving (~1.5s to first token) instead of waiting 5-15s for the
    // full reply. Buffer arriving text and split on the `<<<NEXT>>>`
    // marker — each marker terminates the current bubble and opens a
    // new one, matching the non-streaming bubble semantics.
    let currentBubble = null;
    let typingRemoved = false;
    let pendingText = '';

    const renderInto = (node, text) => {
        const fresh = buildBubble(text);
        // Replace the bubble inside the wrapper while keeping the avatar.
        const bubble = node.querySelector('.bubble');
        if (bubble) node.replaceChild(fresh, bubble);
    };

    const openBubble = () => {
        if (typingNode && !typingRemoved) {
            typingNode.remove();
            typingRemoved = true;
        }
        currentBubble = appendMsg(mind, 'bot', '');
        pendingText = '';
    };

    const onToken = (token) => {
        if (!currentBubble) openBubble();
        pendingText += token;
        // Split bubbles on the locked-persona marker — when one shows up,
        // commit the text before it to the current bubble and open a
        // fresh bubble for whatever follows.
        let cutIdx;
        while ((cutIdx = pendingText.indexOf('<<<NEXT>>>')) !== -1) {
            const before = pendingText.slice(0, cutIdx).trim();
            if (before) renderInto(currentBubble, before);
            pendingText = pendingText.slice(cutIdx + '<<<NEXT>>>'.length);
            currentBubble = appendMsg(mind, 'bot', '');
        }
        if (pendingText) renderInto(currentBubble, pendingText);
    };

    try {
        await streamSimonChat(text, onToken);
        // Final flush — any text after the last marker is already rendered
        // by the loop above; nothing more to do unless the stream produced
        // zero tokens (rare, but happens when the brain short-circuits).
        if (!currentBubble) {
            if (typingNode && !typingRemoved) typingNode.remove();
            appendMsg(mind, 'bot', "I don't have that in my knowledge base just yet — I'll flag it for the team.");
        } else if (!pendingText.trim() && !currentBubble.querySelector('.bubble').firstChild) {
            // Empty trailing bubble after a marker — drop it.
            currentBubble.remove();
        }
    } catch (e) {
        if (typingNode && !typingRemoved) typingNode.remove();
        if (currentBubble) currentBubble.remove();
        appendMsg(mind, 'bot', "Couldn't reach Simon's brain right now. Try again in a moment.");
    }
}

// Simon greeting only — Maeve runs as a live voice demo (echo-voice.js),
// Hugo is a static Slack preview.
(function seedDemoGreetings() {
    appendMsg('simon', 'bot', "G'day — I'm Simon, the real one. Trained on this exact site. Ask me about pricing, plans, the three Minds, or how to get started.");
})();

// Wire send buttons + Enter key + suggestion chips
(function wireDemoControls() {
    document.querySelectorAll('[data-send]').forEach(btn => {
        btn.addEventListener('click', () => sendMsg(btn.dataset.send));
    });
    const simonInput = document.getElementById('input-simon');
    if (simonInput) simonInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); sendMsg('simon'); }
    });
    document.querySelectorAll('.suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => sendMsg(btn.dataset.mind, btn.textContent));
    });
})();

