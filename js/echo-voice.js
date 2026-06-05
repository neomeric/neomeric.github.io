// ────────────────────────────────────────────────────────────────────
// Maeve browser voice demo
// ────────────────────────────────────────────────────────────────────
// Lifecycle:
//   1. User submits email + business in the modal
//   2. POST /demo/voice-token  →  { token, voiceWsUrl, expiresAt }
//   3. Request mic permission, open AudioContext @ 24kHz
//   4. Open WS to voiceWsUrl, send { type:'auth', demoToken } first
//   5. Capture mic via AudioWorklet → PCM16 → base64 → input_audio_buffer.append
//   6. On response.audio.delta → queue PCM16 chunks for continuous playback
//   7. On response.audio_transcript.delta + input_audio_transcription.delta
//      → append to transcript panel
//   8. 180s countdown, then auto-end with "schedule a longer demo" CTA
// ────────────────────────────────────────────────────────────────────

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '')
    ? 'http://localhost:8000'
    : 'https://api.neomindhub.com';

const SAMPLE_RATE = 24000; // Voice Live wants 24kHz PCM16

// ── AudioWorklet processor (inlined as Blob) ──────────────────────────
const WORKLET_SRC = `
class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = new Float32Array(0);
    }
    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        const ch = input[0]; // mono mic
        // Coalesce ~50ms chunks (1200 samples at 24kHz)
        const merged = new Float32Array(this._buffer.length + ch.length);
        merged.set(this._buffer, 0);
        merged.set(ch, this._buffer.length);
        const FRAME = 1200;
        let offset = 0;
        while (merged.length - offset >= FRAME) {
            const chunk = merged.subarray(offset, offset + FRAME);
            this.port.postMessage(chunk.slice());
            offset += FRAME;
        }
        this._buffer = merged.slice(offset);
        return true;
    }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

function f32ToPcm16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        let s = Math.max(-1, Math.min(1, f32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

function pcm16ToF32(int16) {
    const out = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        out[i] = int16[i] / 0x8000;
    }
    return out;
}

function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function base64ToInt16Array(b64) {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Int16Array(buf);
}

// ── Maeve demo controller ──────────────────────────────────────────────
class MaeveDemo {
    constructor() {
        this.audioCtx = null;
        this.workletUrl = null;
        this.micStream = null;
        this.captureNode = null;
        this.ws = null;
        this.playCursor = 0;
        this.scheduledNodes = [];
        this.transcriptCallback = null;
        this.endCallback = null;
        this.statusCallback = null;
        this.endTimer = null;
        this.endingDeliberate = false;
    }

    onTranscript(fn) { this.transcriptCallback = fn; }
    onEnd(fn) { this.endCallback = fn; }
    onStatus(fn) { this.statusCallback = fn; }
    onFirstAudio(fn) { this.firstAudioCallback = fn; }

    _status(s) { if (this.statusCallback) this.statusCallback(s); }

    async start({ name, email, businessName, durationSeconds = 180 }) {
        this._status('Requesting voice token…');

        // 1. Get token
        const tokenResp = await fetch(API_BASE + '/demo/voice-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, businessName: businessName || '' }),
        });
        if (!tokenResp.ok) {
            const detail = await tokenResp.json().catch(() => ({}));
            throw new Error(detail.detail || `Token request failed (${tokenResp.status})`);
        }
        const { token, voiceWsUrl } = await tokenResp.json();

        // 2. Mic permission + AudioContext at 24kHz
        this._status('Requesting microphone…');
        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
            },
        });
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
        // Defensive: browser autoplay policies sometimes leave the context
        // suspended even when created during a user gesture if any awaits
        // ran beforehand. Explicit resume avoids silent-audio bugs.
        if (this.audioCtx.state === 'suspended') {
            try { await this.audioCtx.resume(); } catch (_) { /* ignore */ }
        }
        this.workletUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        await this.audioCtx.audioWorklet.addModule(this.workletUrl);

        // 3. Open WebSocket
        this._status('Connecting to Maeve…');
        this.ws = new WebSocket(voiceWsUrl);
        this.ws.binaryType = 'arraybuffer';

        await new Promise((resolve, reject) => {
            // 20 s window — Australia → East Asia round trips occasionally spike;
            // 10 s caused false-negative timeouts even when the server-side log
            // showed a successful connect.
            const to = setTimeout(() => reject(new Error('WebSocket open timeout')), 20000);
            this.ws.addEventListener('open', () => { clearTimeout(to); resolve(); }, { once: true });
            this.ws.addEventListener('error', () => { clearTimeout(to); reject(new Error('WebSocket error')); }, { once: true });
        });

        // 4. Auth handshake. We deliberately do NOT send a `voice` field —
        // the public demo always uses the voice service's canonical default
        // (DEFAULT_VOICE in neomind-voice's voice-config.ts, currently Azure
        // Dragon HD / Ava). Locked product rule: the demo must reflect the
        // configured production voice exactly, with no client-side override
        // path that can drift from the canonical choice.
        this.ws.send(JSON.stringify({
            type: 'auth',
            demoToken: token,
            model: 'gpt-realtime',
        }));

        // 5. Wire incoming events
        this.ws.addEventListener('message', (ev) => this._handleServerEvent(ev));
        this.ws.addEventListener('close', (ev) => this._handleClose(ev));
        this.ws.addEventListener('error', () => this._handleError());

        // 6. Start mic capture.
        // CRITICAL: Chrome will suspend processing on AudioWorkletNodes that
        // are not connected (directly or transitively) to a destination.
        // Declaring `numberOfOutputs: 0` makes the node an explicit sink so
        // its `process()` keeps running and we receive mic chunks.
        const source = this.audioCtx.createMediaStreamSource(this.micStream);
        this.captureNode = new AudioWorkletNode(this.audioCtx, 'capture-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
        });
        this.captureNode.port.onmessage = (e) => this._sendAudioChunk(e.data);
        source.connect(this.captureNode);

        // 7. Start countdown
        this.endingDeliberate = false;
        this.endTimer = setTimeout(() => {
            this.endingDeliberate = true;
            this.stop('time');
        }, durationSeconds * 1000);

        this.playCursor = this.audioCtx.currentTime;
        this._status('Connected — start talking');
    }

    _sendAudioChunk(f32chunk) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const pcm16 = f32ToPcm16(f32chunk);
        const b64 = arrayBufferToBase64(pcm16.buffer);
        if (!this._loggedFirstSend) {
            this._loggedFirstSend = true;
            console.log('[Maeve] First mic chunk sent — ' + pcm16.length + ' samples');
        }
        this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: b64,
        }));
    }

    _handleServerEvent(ev) {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const t = msg.type;
        if (!t) return;

        // Audio playback (Voice Live emits PCM16 base64 in delta events)
        if (t === 'response.audio.delta' && msg.delta) {
            this._enqueueAudio(msg.delta);
            return;
        }

        // Transcript streams — both directions
        if (t === 'response.audio_transcript.delta' && msg.delta) {
            this.transcriptCallback?.({ role: 'maeve', delta: msg.delta, partial: true });
            return;
        }
        if (t === 'response.audio_transcript.done' && msg.transcript) {
            this.transcriptCallback?.({ role: 'maeve', text: msg.transcript, partial: false });
            return;
        }
        if (t === 'conversation.item.input_audio_transcription.delta' && msg.delta) {
            this.transcriptCallback?.({ role: 'caller', delta: msg.delta, partial: true });
            return;
        }
        if (t === 'conversation.item.input_audio_transcription.completed' && msg.transcript) {
            this.transcriptCallback?.({ role: 'caller', text: msg.transcript, partial: false });
            return;
        }

        // Errors
        if (t === 'error') {
            this._status('Maeve error: ' + (msg.message || msg.error?.message || 'unknown'));
            return;
        }

        // Optional status pings: response.created / response.done
        if (t === 'response.created') this._status('Maeve is thinking…');
        if (t === 'response.done') this._status('Connected — start talking');
    }

    _enqueueAudio(b64) {
        if (!this.audioCtx) return;
        // Defensive: if the context got suspended (tab backgrounded, autoplay
        // policy, etc.) we'd silently drop audio. Resume is a no-op when running.
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => { /* ignore */ });
        }
        const int16 = base64ToInt16Array(b64);
        const f32 = pcm16ToF32(int16);
        if (!this._loggedFirstAudio) {
            this._loggedFirstAudio = true;
            console.log('[Maeve] First audio chunk received — len=' + int16.length + ' samples');
            // Tell the UI to drop the connecting overlay — Maeve is talking.
            if (this.firstAudioCallback) {
                try { this.firstAudioCallback(); } catch (_) { /* ignore */ }
            }
        }
        const buffer = this.audioCtx.createBuffer(1, f32.length, SAMPLE_RATE);
        buffer.copyToChannel(f32, 0);
        const node = this.audioCtx.createBufferSource();
        node.buffer = buffer;
        node.connect(this.audioCtx.destination);
        const startAt = Math.max(this.audioCtx.currentTime, this.playCursor);
        node.start(startAt);
        this.playCursor = startAt + buffer.duration;
        this.scheduledNodes.push(node);
        node.onended = () => {
            const idx = this.scheduledNodes.indexOf(node);
            if (idx >= 0) this.scheduledNodes.splice(idx, 1);
        };
    }

    _handleClose(ev) {
        this._status(ev.wasClean ? 'Call ended' : `Disconnected (${ev.code})`);
        this._cleanup();
        this.endCallback?.({ reason: this.endingDeliberate ? 'time' : 'remote', code: ev.code });
    }

    _handleError() {
        this._status('Connection error');
    }

    stop(reason = 'user') {
        if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try { this.ws.close(1000, reason); } catch { /* ignore */ }
        } else {
            this._cleanup();
            this.endCallback?.({ reason, code: 1000 });
        }
    }

    _cleanup() {
        this.scheduledNodes.forEach((n) => { try { n.stop(); } catch { /* ignore */ } });
        this.scheduledNodes = [];
        if (this.captureNode) { try { this.captureNode.disconnect(); } catch { /* ignore */ } this.captureNode = null; }
        if (this.micStream) {
            this.micStream.getTracks().forEach((t) => t.stop());
            this.micStream = null;
        }
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
            this.audioCtx = null;
        }
        if (this.workletUrl) { URL.revokeObjectURL(this.workletUrl); this.workletUrl = null; }
        this.ws = null;
    }
}

// ── UI wiring ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('maeve-start');
    const modal = document.getElementById('maeve-modal');
    const form = document.getElementById('maeve-form');
    const cancelBtn = document.getElementById('maeve-cancel');
    const errorEl = document.getElementById('maeve-error');
    const cta = document.getElementById('maeve-cta');
    const stage = document.getElementById('maeve-stage');
    const stageHeader = document.getElementById('maeve-stage-header');
    const stageStatus = document.getElementById('maeve-status');
    const stageTimer = document.getElementById('maeve-timer');
    const stageTranscript = document.getElementById('maeve-transcript');
    const stopBtn = document.getElementById('maeve-stop');
    const endStage = document.getElementById('maeve-end');
    const endRetryBtn = document.getElementById('maeve-retry');
    const connectOverlay = document.getElementById('maeve-connect-overlay');
    const connectStatus = document.getElementById('maeve-connect-status');
    const connectSub = document.getElementById('maeve-connect-sub');

    if (!startBtn) return; // not on this page

    let demo = null;
    let countdownInterval = null;
    let lastUserTurn = null;
    let lastEchoTurn = null;

    const showError = (msg) => {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    };
    const hideError = () => { errorEl.classList.add('hidden'); errorEl.textContent = ''; };

    const openModal = () => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const emailInput = document.getElementById('maeve-email');
        if (emailInput) emailInput.focus();
    };
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        hideError();
    };

    const startCountdown = (seconds) => {
        let remaining = seconds;
        stageTimer.textContent = remaining + 's';
        if (stageHeader) stageHeader.classList.remove('warning');
        let warned = false;
        countdownInterval = setInterval(() => {
            remaining -= 1;
            if (remaining < 0) { clearInterval(countdownInterval); return; }
            stageTimer.textContent = remaining + 's';
            // ≤10s: amber warning style + status whisper. The actual stop
            // still fires from MaeveDemo's own endTimer at 0s — this is just
            // a heads-up so the cut feels less abrupt.
            if (!warned && remaining <= 10) {
                warned = true;
                if (stageHeader) stageHeader.classList.add('warning');
                stageStatus.textContent = 'Wrapping up — 10 seconds left';
            }
        }, 1000);
    };

    const stopCountdown = () => {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    };

    const appendTurn = ({ role, text, delta, partial }) => {
        // Stream deltas into the same bubble per turn; `done` events with full
        // text REPLACE the bubble's content (don't create a new bubble).
        const isCaller = role === 'caller';
        let target = isCaller ? lastUserTurn : lastEchoTurn;
        if (!target) {
            target = document.createElement('div');
            target.className = 'maeve-turn ' + role;
            const av = document.createElement('div');
            av.className = 'maeve-av';
            av.textContent = isCaller ? '👤' : 'E';
            const bub = document.createElement('div');
            bub.className = 'maeve-bub';
            bub.textContent = '';
            target.appendChild(av);
            target.appendChild(bub);
            stageTranscript.appendChild(target);
            if (isCaller) lastUserTurn = target; else lastEchoTurn = target;
        }
        const bub = target.querySelector('.maeve-bub');
        if (text !== undefined) {
            // Final transcript: canonical replacement (handles delta drift)
            bub.textContent = text;
        } else if (delta) {
            bub.textContent += delta;
        }
        if (!partial) {
            // Turn finalized — next event for this role starts a new bubble
            if (isCaller) lastUserTurn = null; else lastEchoTurn = null;
        }
        stageTranscript.scrollTop = stageTranscript.scrollHeight;
    };

    // The Maeve panel has 3 sibling screens (cta, stage, end). Only one should
    // be visible at a time — they are NOT mutually exclusive by default.
    const showCta = () => {
        cta.classList.remove('hidden');
        stage.classList.add('hidden');
        endStage.classList.add('hidden');
    };
    const showStage = () => {
        cta.classList.add('hidden');
        stage.classList.remove('hidden');
        endStage.classList.add('hidden');
        stageTranscript.replaceChildren();
        lastUserTurn = null;
        lastEchoTurn = null;
        stageStatus.textContent = 'Connecting…';
        stageTimer.textContent = '90s';
        if (stageHeader) stageHeader.classList.remove('warning');
        if (connectOverlay) connectOverlay.classList.remove('hidden');
        if (connectStatus) connectStatus.textContent = 'Setting up your call…';
        if (connectSub) connectSub.textContent = 'This usually takes a few seconds';
    };

    // Map MaeveDemo internal status strings → friendly overlay copy.
    // The overlay sits above the transcript until Maeve actually starts
    // talking (first audio chunk), so the user sees progress while we're
    // negotiating mic, token, WebSocket.
    const overlayCopy = (raw) => {
        const s = (raw || '').toLowerCase();
        if (s.includes('voice token')) return ['Setting up your call…', 'Just a moment'];
        if (s.includes('microphone')) return ['Tuning your microphone…', 'Allow access if your browser asks'];
        if (s.includes('connecting to maeve')) return ['Calling Maeve…', 'Almost there'];
        if (s.includes('connected')) return ['Saying hi…', 'Maeve will speak first'];
        if (s.includes('thinking')) return ['Maeve is thinking…', null];
        return [raw, null];
    };
    const showEndStage = () => {
        cta.classList.add('hidden');
        stage.classList.add('hidden');
        endStage.classList.remove('hidden');
    };

    startBtn.addEventListener('click', () => {
        hideError();
        openModal();
    });

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const name = document.getElementById('maeve-name').value.trim();
        const email = document.getElementById('maeve-email').value.trim();
        const businessName = document.getElementById('maeve-business').value.trim();
        if (!name || !email) {
            showError('Name and email are required.');
            return;
        }
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connecting…';
        try {
            demo = new MaeveDemo();
            demo.onStatus((s) => {
                stageStatus.textContent = s;
                if (connectOverlay && !connectOverlay.classList.contains('hidden')) {
                    const [main, sub] = overlayCopy(s);
                    if (connectStatus && main) connectStatus.textContent = main;
                    if (connectSub) connectSub.textContent = sub || '';
                }
            });
            demo.onFirstAudio(() => {
                if (connectOverlay) connectOverlay.classList.add('hidden');
            });
            demo.onTranscript(appendTurn);
            demo.onEnd(() => {
                stopCountdown();
                if (connectOverlay) connectOverlay.classList.add('hidden');
                showEndStage();
            });
            closeModal();
            showStage();
            await demo.start({ name, email, businessName, durationSeconds: 180 });
            startCountdown(180);
        } catch (err) {
            console.error('[Maeve] start failed', err);
            showError(err.message || 'Could not start the demo.');
            showCta();   // restore initial screen so the user can retry
            openModal();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Start 90-second demo';
        }
    });

    stopBtn.addEventListener('click', () => {
        if (demo) demo.stop('user');
    });

    endRetryBtn.addEventListener('click', () => {
        showCta();
        openModal();
    });
});
