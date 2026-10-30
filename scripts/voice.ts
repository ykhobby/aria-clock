// Records every voice line with Gemini text-to-speech and saves small AAC clips
// into public/voice/ for the app to play offline.
//
//   npm run voice -- voices                 list voices (Australian first)
//   npm run voice -- sample Kore,Leda       record a test sentence in each voice
//   npm run voice -- build --voice Leda     record every line that's new or changed
//        [--batch 120]                      lines per request (cut apart at the pauses)
//        [--fake]                           test batching offline with the Mac voice
//   npm run voice -- verify [--fix]         listen back to every clip; --fix drops bad ones
//   npm run voice -- script                 write VOICE_SCRIPT.csv (all lines)
//   npm run voice -- import <folder>        use your own WAV files named <id>.wav
//
// The API key is read from GEMINI_API_KEY or from a .env.local file
// (GEMINI_API_KEY=...). It is only used here on your Mac, never in the app.

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { recordables as allLines, type Line } from '../src/voice/lines';
import { alignTranscript, cutAtLongPauses, parseNumbered, parseSilences, sameWords } from './split';

const PAUSE_TAG = '<long pause>';

const ROOT = resolve(__dirname, '..');
let OUT = join(ROOT, 'public/voice');
let CACHE = join(ROOT, '.voice-cache');
const SAMPLES = join(ROOT, 'voice-samples');
let MANIFEST = join(OUT, 'manifest.json');
const API = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash-tts';
// Models that listen back to clips; each has its own daily quota, so move on when one runs out.
const CHECK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
let checkModel = 0;

/** How each kind of line should sound. Accent comes from the voice itself. */
function styleFor(id: string): string {
  const base = 'Warm, gentle and cheerful, like a kind teacher talking to a six-year-old. Clear and unhurried.';
  if (id.startsWith('praise-') || id.startsWith('ev-levelup-')) return 'Delighted and excited, celebrating with a six-year-old. Warm and bright.';
  if (id.startsWith('time-')) return 'Clear and friendly, saying a time to a young child.';
  return base;
}

// ---- helpers ------------------------------------------------------------
function apiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const f = join(ROOT, '.env.local');
  if (existsSync(f)) {
    const m = readFileSync(f, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  }
  console.error('No API key. Put GEMINI_API_KEY=... in aria-clock/.env.local (it is git-ignored).');
  process.exit(1);
}

function args() {
  const [cmd = 'help', ...rest] = process.argv.slice(2);
  const flags: Record<string, string> = {};
  const pos: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') ? 'true' : rest[++i] ?? 'true';
    else pos.push(rest[i]);
  }
  return { cmd, flags, pos };
}

class QuotaError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Manifest {
  voice: string;
  model: string;
  clips: Record<string, string>;
  hashes: Record<string, string>;
}

function readManifest(): Manifest | null {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

/** Find base64 audio anywhere in the response (handles both API shapes). */
function findAudio(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (r.type === 'audio' && typeof r.data === 'string') return r.data;
  const inline = (r.inlineData ?? r.inline_data) as Record<string, unknown> | undefined;
  if (inline && typeof inline.data === 'string') return inline.data;
  for (const v of Object.values(r)) {
    const found = Array.isArray(v) ? v.map(findAudio).find(Boolean) : findAudio(v);
    if (found) return found;
  }
  return null;
}

/** 24 kHz 16-bit mono PCM → WAV, for responses that come back headerless. */
function ensureWav(buf: Buffer): Buffer {
  if (buf.subarray(0, 4).toString() === 'RIFF') return buf;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + buf.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(buf.length, 40);
  return Buffer.concat([h, buf]);
}

async function tts(text: string, voice: string, style: string, model: string): Promise<Buffer> {
  const body = {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/interactions`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = findAudio(await res.json());
      if (!data) throw new Error('No audio in response');
      return ensureWav(Buffer.from(data, 'base64'));
    }
    const msg = await res.text();
    if (res.status === 429 && /per day/i.test(msg)) throw new QuotaError(msg);
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Math.min(60_000, 2000 * 2 ** attempt);
      console.log(`  ${res.status}, waiting ${Math.round(wait / 1000)}s…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${res.status} ${msg.slice(0, 400)}`);
  }
}

/** Ask a listening model what each clip says. The clips are joined with long
 *  gaps in a RANDOM order, then the answers are put back in order: played in
 *  sequence ("one minute past, two minutes past…") a model will happily predict
 *  the next line instead of listening, and hide a clip that's out by one.
 *  Cached by clip contents. */
async function listenToClips(wavs: string[]): Promise<string[]> {
  const dir = join(CACHE, 'listen');
  mkdirSync(dir, { recursive: true });
  const key = createHash('sha1').update('shuffled-v2');
  for (const w of wavs) key.update(readFileSync(w));
  const id = key.digest('hex').slice(0, 12);
  const cached = join(dir, `${id}.txt`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));

  const order = wavs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const gap = join(dir, 'gap.wav');
  if (!existsSync(gap)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '2.5', '-c:a', 'pcm_s16le', gap]);
  const parts = order.map((wi, i) => {
    const p = join(dir, `part-${i}.wav`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavs[wi], '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', p]);
    return p;
  });
  const list = join(dir, 'list.txt');
  writeFileSync(list, parts.flatMap((p) => [`file '${p}'`, `file '${gap}'`]).join('\n'));
  const reel = join(dir, `${id}.m4a`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '32k', reel]);
  for (const p of parts) rmSync(p, { force: true });

  const n = wavs.length;
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'audio/mp4', data: readFileSync(reel).toString('base64') } },
          {
            text: `This recording has ${n} unrelated clips in random order, separated by silences of over two seconds. A clip may contain more than one sentence, or only a fragment. Transcribe exactly what you hear in each clip on one line, keeping a clip's sentences together, in order. Do not guess from context or patterns. Write numbers as words exactly as spoken. Output exactly ${n} numbered lines like "1. text".`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/models/${CHECK_MODELS[checkModel]}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const j = (await res.json()) as { candidates: { content: { parts: { text?: string }[] } }[] };
      const shuffled = parseNumbered(j.candidates[0].content.parts.map((p) => p.text ?? '').join(''), n);
      const heard = new Array<string>(n).fill('');
      order.forEach((wi, i) => (heard[wi] = shuffled[i]));
      writeFileSync(cached, JSON.stringify(heard));
      rmSync(reel, { force: true });
      return heard;
    }
    const msg = await res.text();
    if ((res.status === 429 && /quota/i.test(msg)) || res.status === 404) {
      if (++checkModel >= CHECK_MODELS.length) throw new QuotaError(`every listening model is out of quota today: ${msg.slice(0, 200)}`);
      console.log(`\n  listening model out of quota, switching to ${CHECK_MODELS[checkModel]}`);
      attempt = -1;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(Math.min(60_000, 3000 * 2 ** attempt));
      continue;
    }
    throw new Error(`listening check ${res.status} ${msg.slice(0, 300)}`);
  }
}

/** WAV → trimmed, normalised AAC (.m4a), which iPad Safari plays natively. */
function encode(wavPath: string, outPath: string) {
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03';
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', wavPath,
    '-af', `${trim},areverse,${trim},areverse,loudnorm=I=-18:TP=-2`,
    '-ar', '24000', '-ac', '1', '-c:a', 'aac', '-b:a', '40k', outPath,
  ]);
}

function duration(wav: string): number {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim());
}

function silencesIn(wav: string) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-']);
  return parseSilences(r.stderr.toString());
}

function cut(wav: string, start: number, end: number, out: string) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ss', String(start), '-to', String(end), '-c', 'copy', out]);
}

/** Stand-in for Gemini using macOS `say`, for testing the splitter offline. */
async function sayTts(text: string): Promise<Buffer> {
  const aiff = join(CACHE, 'say.aiff');
  const wav = join(CACHE, 'say.wav');
  execFileSync('say', ['-v', 'Karen', '-o', aiff, text.split(`\n${PAUSE_TAG}\n`).join(' [[slnc 1100]] ')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '24000', '-ac', '1', wav]);
  return readFileSync(wav);
}

const hashOf = (l: Line, voice: string, model: string) =>
  createHash('sha1').update(`${voice}|${model}|${styleFor(l.id)}|${l.text}`).digest('hex').slice(0, 12);

// ---- commands -----------------------------------------------------------
async function listVoices() {
  const key = apiKey();
  const tries = ['language_code=en-AU', 'region_code=AU', 'accent=Australian', 'language_code=en'];
  for (const q of tries) {
    const res = await fetch(`${API}/voices?${q}&page_size=200`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) {
      console.log(`${q}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const data = (await res.json()) as { voices?: Record<string, unknown>[] };
    const voices = data.voices ?? [];
    console.log(`\n== ${q}: ${voices.length} voices`);
    for (const v of voices.slice(0, 60)) {
      console.log(
        [v.id ?? v.name, v.display_name ?? v.displayName, v.accent, v.language_code ?? v.languageCode, v.gender, v.description]
          .filter(Boolean)
          .join(' · '),
      );
    }
    if (voices.length && q !== 'language_code=en') return;
  }
}

async function sample(voices: string[], model: string) {
  mkdirSync(SAMPLES, { recursive: true });
  const text = "Hi Aria! This is your watch. Ooh, nearly! The short hand has just gone past three. It's half past three. Great job, Aria!";
  for (const v of voices) {
    process.stdout.write(`${v}… `);
    const wav = await tts(text, v, styleFor('intro-'), model);
    const w = join(SAMPLES, `${v}.wav`);
    writeFileSync(w, wav);
    encode(w, join(SAMPLES, `${v}.m4a`));
    console.log('saved');
  }
  console.log(`\nListen in ${SAMPLES}`);
}

async function build(voice: string, model: string, batchSize: number, speakFn = tts) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(CACHE, { recursive: true });
  const lines = allLines();
  const prev = readManifest();
  const man: Manifest = { voice, model, clips: {}, hashes: {} };
  const todo: Line[] = [];
  for (const l of lines) {
    const hash = hashOf(l, voice, model);
    const file = `${l.id}.m4a`;
    const recordedBefore = !prev?.hashes[l.id] && existsSync(join(CACHE, `${l.id}.wav`)) && existsSync(join(OUT, file));
    if ((prev?.hashes[l.id] === hash || recordedBefore) && existsSync(join(OUT, file))) {
      man.clips[l.id] = file;
      man.hashes[l.id] = hash;
    } else todo.push(l);
  }
  console.log(`${lines.length} lines · ${lines.length - todo.length} already recorded · ${todo.length} to record with ${voice}`);

  let done = 0;
  let failed = 0;
  let quotaHit = '';
  let requests = 0;
  const todoCount = todo.length;
  const save = () => writeFileSync(MANIFEST, JSON.stringify(man, null, 0));
  const status = () => process.stdout.write(`\r  recorded ${done}/${todoCount} · requests ${requests}${failed ? ` · failed ${failed}` : ''}   `);

  const accept = (l: Line, wavPath: string) => {
    encode(wavPath, join(OUT, `${l.id}.m4a`));
    man.clips[l.id] = `${l.id}.m4a`;
    man.hashes[l.id] = hashOf(l, voice, model);
    done++;
  };

  const retry: Line[] = [];

  // Record a batch in one request, then cut it back into one clip per line.
  // Cuts go at the longest pauses; a transcript of the batch confirms every
  // line was said as written. Lines that weren't are re-recorded afterwards.
  const recordBatch = async (batch: Line[]): Promise<void> => {
    const key = createHash('sha1').update(`${voice}|${model}|${batch.map((l) => hashOf(l, voice, model)).join(',')}`).digest('hex').slice(0, 12);
    const whole = join(CACHE, `batch-${key}.wav`);
    if (!existsSync(whole)) {
      requests++;
      const text = batch.map((l) => l.text).join(`\n${PAUSE_TAG}\n`);
      writeFileSync(whole, await speakFn(text, voice, styleFor(batch[0].id), model));
    }
    if (batch.length === 1) {
      const w = join(CACHE, `${batch[0].id}.wav`);
      writeFileSync(w, readFileSync(whole));
      accept(batch[0], w);
    } else {
      const total = duration(whole);
      const texts = batch.map((l) => l.text);
      // Cut at the long pauses, listen to every piece on its own, and give
      // each script line the piece that says exactly it. Stray or broken
      // pieces are dropped; lines with no matching piece are recorded again.
      const pieces = cutAtLongPauses(silencesIn(whole), batch.length, total);
      if (!pieces) {
        console.log(`\n  batch of ${batch.length} from ${batch[0].id} didn't split cleanly, retrying in halves`);
        const mid = Math.ceil(batch.length / 2);
        await recordBatch(batch.slice(0, mid));
        await recordBatch(batch.slice(mid));
        return;
      }
      const pieceWavs = pieces.map((p, i) => {
        const w = join(CACHE, `piece-${key}-${i}.wav`);
        cut(whole, p.start, p.end, w);
        return w;
      });
      const heard = speakFn === tts ? await listenToClips(pieceWavs) : texts;
      const matched = new Set<number>();
      for (const [pi, li] of alignTranscript(heard, texts)) {
        const w = join(CACHE, `${batch[li].id}.wav`);
        writeFileSync(w, readFileSync(pieceWavs[pi]));
        accept(batch[li], w);
        matched.add(li);
      }
      for (const w of pieceWavs) rmSync(w, { force: true });
      const strays = pieces.length - matched.size;
      batch.forEach((l, i) => !matched.has(i) && retry.push(l));
      if (matched.size < batch.length || strays)
        console.log(`\n  batch from ${batch[0].id}: ${matched.size}/${batch.length} kept${strays ? `, ${strays} extra piece(s) dropped` : ''}${matched.size < batch.length ? `, ${batch.length - matched.size} to re-record` : ''}`);
    }
    // The whole batch stays in .voice-cache so it can be re-cut without a new request.
    save(); // resumable if stopped part way
    status();
  };

  // One style per request, so group lines that sound alike.
  const groups = new Map<string, Line[]>();
  for (const l of todo) groups.set(styleFor(l.id), [...(groups.get(styleFor(l.id)) ?? []), l]);
  const batches: Line[][] = [];
  for (const g of groups.values()) for (let i = 0; i < g.length; i += batchSize) batches.push(g.slice(i, i + batchSize));
  console.log(`  ${batches.length} requests of up to ${batchSize} lines`);

  // Lines that came out wrong get one more go, together in a final batch.
  let retried = false;
  for (let b = batches.shift(); b; b = batches.shift()) {
    try {
      await recordBatch(b);
      if (!batches.length && retry.length && !retried) {
        retried = true;
        batches.push(retry.splice(0));
      }
    } catch (e) {
      if (e instanceof QuotaError) {
        quotaHit = (e as Error).message;
        break;
      }
      failed += b.length;
      console.log(`\n  ✗ batch from ${b[0].id}: ${(e as Error).message}`);
    }
  }
  // Drop clips for lines that no longer exist.
  const keep = new Set(Object.values(man.clips));
  for (const f of readdirSync(OUT)) if (f.endsWith('.m4a') && !keep.has(f)) rmSync(join(OUT, f));
  save();
  if (quotaHit) console.log(`\n\nStopped: Gemini's daily limit was reached.\n${quotaHit.slice(0, 300)}\nRun the same command again later; it carries on where it stopped.`);
  console.log(`\nDone. ${Object.keys(man.clips).length}/${lines.length} lines have audio.${failed ? ' Run again to retry failures.' : ''}`);
}

/** Listen back to every saved clip, one by one, and flag any that don't say
 *  their line. With --fix, flagged clips are removed so the next build redoes them. */
async function verify(fix: boolean) {
  const man = readManifest();
  if (!man) throw new Error('No recordings yet');
  const lines = allLines().filter((l) => man.clips[l.id]);
  const dir = join(CACHE, 'verify');
  mkdirSync(dir, { recursive: true });
  const bad: { l: Line; heard: string }[] = [];
  const CHUNK = 60;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK);
    const wavs = chunk.map((l) => {
      const w = join(dir, `${l.id}.wav`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, man.clips[l.id]), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', w]);
      return w;
    });
    const heard = await listenToClips(wavs);
    chunk.forEach((l, j) => !sameWords(heard[j], l.text) && bad.push({ l, heard: heard[j] }));
    for (const w of wavs) rmSync(w, { force: true });
    process.stdout.write(`\r  checked ${Math.min(i + CHUNK, lines.length)}/${lines.length} · flagged ${bad.length}   `);
  }
  console.log('');
  for (const { l, heard } of bad) console.log(`  ✗ ${l.id}: wanted "${l.text}", heard "${heard}"`);
  if (fix && bad.length) {
    for (const { l } of bad) {
      delete man.clips[l.id];
      delete man.hashes[l.id];
      rmSync(join(OUT, `${l.id}.m4a`), { force: true });
    }
    writeFileSync(MANIFEST, JSON.stringify(man, null, 0));
    console.log(`Removed ${bad.length} clips; the next build re-records them.`);
  }
  console.log(`${lines.length - bad.length}/${lines.length} clips say their line.`);
}

/** Reuse clips from an earlier catalogue whose wording is exactly a phrase we need now. */
function reuse(oldManifest: string, oldScript: string) {
  const old = JSON.parse(readFileSync(oldManifest, 'utf8')) as Manifest;
  const textOf = new Map<string, string>();
  for (const row of readFileSync(oldScript, 'utf8').split('\n').slice(1)) {
    const m = row.match(/^([^,]+),"(.*)"$/);
    if (m) textOf.set(m[1], m[2].replace(/""/g, '"'));
  }
  const byText = new Map<string, string>();
  for (const [id, file] of Object.entries(old.clips)) {
    const text = textOf.get(id);
    if (text && existsSync(join(OUT, file))) byText.set(text.replace(/…$/, '').trim(), file);
  }
  const man: Manifest = { voice: old.voice, model: old.model, clips: {}, hashes: {} };
  const keep = new Set<string>();
  let n = 0;
  for (const l of allLines()) {
    const file = byText.get(l.text.replace(/…$/, '').trim());
    if (!file || man.clips[l.id]) continue;
    const to = `${l.id}.m4a`;
    writeFileSync(join(OUT, to), readFileSync(join(OUT, file)));
    man.clips[l.id] = to;
    man.hashes[l.id] = hashOf(l, old.voice, old.model);
    keep.add(to);
    n++;
  }
  for (const f of Object.values(man.clips)) keep.add(f);
  // Everything else from the old catalogue (all the separate time clips) goes.
  let removed = 0;
  for (const f of readdirSync(OUT)) if (f.endsWith('.m4a') && !keep.has(f)) (rmSync(join(OUT, f)), removed++);
  man.voice = old.voice;
  man.model = old.model;
  writeFileSync(MANIFEST, JSON.stringify(man, null, 0));
  console.log(`Reused ${n} clips, removed ${removed} old ones. ${Object.keys(man.clips).length}/${allLines().length} phrases have audio.`);
}

function writeScript() {
  const rows = allLines().map((l) => `${l.id},"${l.text.replace(/"/g, '""')}"`);
  const f = join(ROOT, 'VOICE_SCRIPT.csv');
  writeFileSync(f, `id,text\n${rows.join('\n')}\n`);
  console.log(`Wrote ${rows.length} lines to ${f}`);
}

function importFolder(dir: string, voice: string) {
  mkdirSync(OUT, { recursive: true });
  const ids = new Set(allLines().map((l) => l.id));
  const man: Manifest = readManifest() ?? { voice, model: 'manual', clips: {}, hashes: {} };
  let n = 0;
  for (const f of readdirSync(dir)) {
    const id = f.replace(/\.(wav|mp3|m4a)$/i, '');
    if (!ids.has(id)) continue;
    encode(join(dir, f), join(OUT, `${id}.m4a`));
    man.clips[id] = `${id}.m4a`;
    man.hashes[id] = 'manual';
    n++;
  }
  man.voice = voice;
  writeFileSync(MANIFEST, JSON.stringify(man, null, 0));
  console.log(`Imported ${n} clips (${ids.size - Object.keys(man.clips).length} lines still without audio).`);
}

async function main() {
  const { cmd, flags, pos } = args();
  const model = flags.model ?? DEFAULT_MODEL;
  switch (cmd) {
    case 'voices':
      return listVoices();
    case 'sample':
      return sample((pos[0] ?? 'Leda,Aoede,Sulafat,Achernar').split(','), model);
    case 'build':
      if (!flags.voice) throw new Error('Pass --voice <name>');
      if (flags.fake) {
        // Offline test of batching and splitting with the Mac's own voice.
        OUT = join(SAMPLES, 'fake-build');
        CACHE = join(SAMPLES, 'fake-cache');
        MANIFEST = join(OUT, 'manifest.json');
        return build(flags.voice, 'fake', Number(flags.batch ?? 120), sayTts);
      }
      return build(flags.voice, model, Number(flags.batch ?? 120));
    case 'script':
      return writeScript();
    case 'reuse':
      return reuse(pos[0], pos[1]);
    case 'verify':
      return verify(!!flags.fix);
    case 'import':
      if (!pos[0]) throw new Error('Pass the folder of WAV files');
      return importFolder(resolve(pos[0]), flags.voice ?? 'manual');
    default:
      console.log(readFileSync(__filename, 'utf8').split('\n').slice(0, 12).join('\n'));
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
