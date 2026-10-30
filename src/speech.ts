// Read-aloud. Words are recorded Gemini clips in public/voice/ (made with
// scripts/voice.ts); numbers and times — the [bracketed] parts of a line — are
// said by the device's own voice (Australian if available), so they're always
// right. A phrase that hasn't been recorded yet also falls back to the device voice.

import { linesText, plain, segments, type Line } from './voice/lines';

interface Manifest {
  voice: string;
  clips: Record<string, string>; // clip id → file name
}

const BASE = `${import.meta.env.BASE_URL}voice/`;
const GAP_MS = 60; // pause between the parts of one sentence

let enabled = true;
let last: Line[] = [];
let manifest: Manifest | null = null;
let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let playing: AudioBufferSourceNode | null = null;
let generation = 0; // bumps on every new speak(), so stale sequences stop

const manifestReady: Promise<void> = fetch(`${BASE}manifest.json`)
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => {
    manifest = m;
  })
  .catch(() => {
    manifest = null;
  });

// ---- built-in voice fallback ------------------------------------------
let deviceVoice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  deviceVoice =
    voices.find((v) => v.lang === 'en-AU' && /karen|catherine|female/i.test(v.name)) ??
    voices.find((v) => v.lang.replace('_', '-') === 'en-AU') ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null;
}
if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

function deviceSay(text: string): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (deviceVoice) u.voice = deviceVoice;
    u.lang = deviceVoice?.lang ?? 'en-AU';
    u.rate = 0.9;
    u.pitch = 1.1;
    // Some engines never fire onend; don't let a stuck voice freeze the app.
    const safety = setTimeout(resolve, 1500 + text.split(/\s+/).length * 450);
    const done = () => {
      clearTimeout(safety);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}

// ---- recorded clips ---------------------------------------------------
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  ctx = AC ? new AC() : null;
  return ctx;
}

function loadClip(id: string): Promise<AudioBuffer | null> {
  const file = manifest?.clips[id];
  const ac = audio();
  if (!file || !ac) return Promise.resolve(null);
  let p = buffers.get(id);
  if (!p) {
    p = fetch(BASE + file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => ac.decodeAudioData(b))
      .catch(() => null);
    buffers.set(id, p);
  }
  return p;
}

function playBuffer(buf: AudioBuffer, gen: number): Promise<void> {
  const ac = audio()!;
  return new Promise((resolve) => {
    if (gen !== generation) return resolve();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    // If iOS keeps the audio locked, onended never comes; don't hang.
    const safety = setTimeout(resolve, buf.duration * 1000 + 800);
    src.onended = () => {
      clearTimeout(safety);
      resolve();
    };
    playing = src;
    src.start();
  });
}

/** True when this clip has a recording. */
export function hasClip(id: string): boolean {
  return !!manifest?.clips[id];
}

// ---- public API -------------------------------------------------------
export function setSpeechEnabled(on: boolean) {
  enabled = on;
  if (!on) stopSpeaking();
}

/** Say a sentence made of clips. Stops anything already being said. */
export async function speak(lines: Line | Line[]): Promise<void> {
  const seq = Array.isArray(lines) ? lines : [lines];
  last = seq;
  stopSpeaking();
  const gen = ++generation;
  if (!enabled) return;
  await manifestReady;
  const parts = seq.flatMap(segments);
  // Start fetching every clip at once so there are no gaps between them.
  const loads = parts.map((p) => (p.device ? Promise.resolve(null) : loadClip(p.clip!)));
  for (let i = 0; i < parts.length; i++) {
    if (gen !== generation) return;
    const buf = await loads[i];
    if (gen !== generation) return;
    if (buf) await playBuffer(buf, gen);
    else await deviceSay(plain(parts[i].text).replace(/…$/, ''));
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }
}

/** Say the last sentence again (the replay button). */
export function replay() {
  if (last.length) speak(last);
}

export function stopSpeaking() {
  generation++;
  try {
    playing?.stop();
  } catch {
    /* already stopped */
  }
  playing = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** iOS only allows sound after a tap: call this inside a tap handler. */
export function unlockSpeech() {
  // Play like a video does, so the iPhone's silent switch doesn't mute it (Safari 16.4+).
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== 'playback') session.type = 'playback';
  const ac = audio();
  if (ac && ac.state !== 'running') {
    ac.resume().catch(() => undefined);
    // Some iOS versions only wake up once a sound has actually been started in the tap.
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination);
    src.start();
  }
  if (typeof speechSynthesis !== 'undefined' && !speechUnlocked) {
    speechUnlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}
let speechUnlocked = false;

// Unlock on every tap anywhere, not just on some buttons: the app can open
// straight onto a lesson, and iOS locks the audio again after it's been in the background.
if (typeof window !== 'undefined') {
  for (const ev of ['touchend', 'click'] as const) window.addEventListener(ev, unlockSpeech, { capture: true, passive: true });
}

/** Speak, and also wait a readable minimum time (for when the voice is off). */
export async function sayAndWait(lines: Line | Line[], minMs = 0): Promise<void> {
  const text = linesText(Array.isArray(lines) ? lines : [lines]);
  const min = Math.max(minMs, 900 + text.split(/\s+/).length * 330);
  await Promise.all([speak(lines), new Promise((r) => setTimeout(r, enabled ? 400 : min))]);
}

export function voiceName(): string {
  if (manifest) return `${manifest.voice} (${Object.keys(manifest.clips).length} clips)`;
  return deviceVoice ? `${deviceVoice.name} (${deviceVoice.lang})` : 'default voice';
}
