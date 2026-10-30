// Cutting one long batch recording back into one clip per line.
// We know how many lines went in, so the cuts go at the longest pauses, and
// each piece's length is checked against its text before it's accepted.

export interface Gap {
  start: number;
  end: number;
}

/** Parse ffmpeg silencedetect output into pauses (seconds). */
export function parseSilences(ffmpegStderr: string): Gap[] {
  const gaps: Gap[] = [];
  let start: number | null = null;
  for (const line of ffmpegStderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start != null) {
      gaps.push({ start, end: Number(e[1]) });
      start = null;
    }
  }
  return gaps;
}

/** Split [0, total] into n pieces at the n-1 longest inner pauses. Null if there aren't enough. */
export function splitAtLongestGaps(gaps: Gap[], n: number, total: number): Gap[] | null {
  // Pauses touching the very start or end are lead-in/out, not between lines.
  const inner = gaps.filter((g) => g.start > 0.05 && g.end < total - 0.05);
  if (inner.length < n - 1) return null;
  const cuts = [...inner]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, n - 1)
    .sort((a, b) => a.start - b.start);
  const pieces: Gap[] = [];
  let from = 0;
  for (const c of cuts) {
    pieces.push({ start: from, end: c.start });
    from = c.end;
  }
  pieces.push({ start: from, end: total });
  return pieces;
}

/** Cut at every pause that looks like a between-lines pause: at least 60% as
 *  long as the (n-1)th longest. This keeps any stray extra phrase as its own
 *  piece instead of shifting every later cut. */
export function cutAtLongPauses(gaps: Gap[], n: number, total: number): Gap[] | null {
  const inner = gaps.filter((g) => g.start > 0.05 && g.end < total - 0.05);
  if (inner.length < n - 1) return null;
  const lens = inner.map((g) => g.end - g.start).sort((a, b) => b - a);
  const threshold = 0.6 * lens[n - 2];
  const cuts = inner.filter((g) => g.end - g.start >= threshold);
  const pieces: Gap[] = [];
  let from = 0;
  for (const c of cuts) {
    pieces.push({ start: from, end: c.start });
    from = c.end;
  }
  pieces.push({ start: from, end: total });
  return pieces;
}

/** Parse "1. text" lines into an array indexed by number (missing → ''). */
export function parseNumbered(text: string, n: number): string[] {
  const out = new Array<string>(n).fill('');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d+)[.)]\s*(.*)$/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= n) out[Number(m[1]) - 1] = m[2].trim();
  }
  return out;
}

/** Rough spoken length of a line, in seconds. */
export function expectedSeconds(text: string): number {
  const words = text.replace(/[^\p{L}\p{N}' -]/gu, ' ').split(/\s+/).filter(Boolean).length;
  const pauses = (text.match(/[,.!?…]/g) ?? []).length;
  return 0.3 + words * 0.38 + pauses * 0.15;
}

/** Does every piece's length roughly fit its line? Catches skipped or merged lines. */
export function piecesFit(pieces: Gap[], texts: string[], lo = 0.3, hi = 2.6): boolean {
  if (pieces.length !== texts.length) return false;
  return pieces.every((p, i) => {
    const ratio = (p.end - p.start) / expectedSeconds(texts[i]);
    return ratio >= lo && ratio <= hi;
  });
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
const tens = (n: number) => (n <= 20 ? NUMBER_WORDS[n] : `${TENS_WORDS[Math.floor(n / 10)]}${n % 10 ? ` ${NUMBER_WORDS[n % 10]}` : ''}`);

/** Words only, lower case, digits spelled out ("1/4 past 3" → "quarter past three"). */
export function normWords(s: string): string {
  return s
    .replace(/1\/4/g, 'quarter')
    .replace(/1\/2/g, 'half')
    .replace(/\d+/g, (n) => (Number(n) < 60 ? tens(Number(n)) : n))
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\b(zero|o)\b/g, 'oh')
    // "to eight" is often written down as "2 8" or "two eight"
    .replace(/\b(two|too)\b/g, 'to')
    .trim();
}

/** Same words, ignoring case, punctuation, hyphens and digits-vs-words. */
export function sameWords(heard: string | undefined, expected: string): boolean {
  return normWords(heard ?? '') === normWords(expected);
}

/** Pair transcript lines with script lines (longest common sequence of exact
 *  matches). Extra phrases the voice slipped in are skipped; script lines with
 *  no match are left out, to be recorded again. Returns [heardIndex, lineIndex]. */
export function alignTranscript(heard: string[], expected: string[]): [number, number][] {
  const a = heard.map(normWords);
  const b = expected.map(normWords);
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) pairs.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Cut into exactly one piece per line, choosing the pauses that make every
 *  piece's length best fit its text. For voices whose pauses between lines are
 *  no longer than the ones inside a line. Null if there aren't enough pauses. */
export function cutToFit(gaps: Gap[], texts: string[], total: number): Gap[] | null {
  const n = texts.length;
  const inner = gaps.filter((g) => g.start > 0.05 && g.end < total - 0.05);
  if (inner.length < n - 1) return null;
  if (n === 1) return [{ start: 0, end: total }];
  const exp = texts.map(expectedSeconds);
  const speech = total - inner.reduce((s, g) => s + g.end - g.start, 0);
  const scale = Math.max(speech, 0.1) / exp.reduce((a, b) => a + b, 0);
  const fit = (len: number, i: number) => Math.log(Math.max(len, 0.05) / (exp[i] * scale)) ** 2;
  const G = inner.length;
  // best[i][j]: cost of pieces 0..i with piece i ending at inner gap j.
  const best = Array.from({ length: n - 1 }, () => new Array<number>(G).fill(Infinity));
  const from = Array.from({ length: n - 1 }, () => new Array<number>(G).fill(-1));
  const gapScore = (j: number) => inner[j].end - inner[j].start;
  for (let j = 0; j < G; j++) best[0][j] = fit(inner[j].start, 0) - gapScore(j);
  for (let i = 1; i < n - 1; i++)
    for (let j = i; j < G; j++)
      for (let k = i - 1; k < j; k++) {
        const c = best[i - 1][k] + fit(inner[j].start - inner[k].end, i) - gapScore(j);
        if (c < best[i][j]) {
          best[i][j] = c;
          from[i][j] = k;
        }
      }
  let last = -1;
  let cost = Infinity;
  for (let j = n - 2; j < G; j++) {
    const c = best[n - 2][j] + fit(total - inner[j].end, n - 1);
    if (c < cost) {
      cost = c;
      last = j;
    }
  }
  if (last < 0) return null;
  const cuts: number[] = [];
  for (let i = n - 2, j = last; i >= 0; j = from[i][j], i--) cuts.unshift(j);
  const pieces: Gap[] = [];
  let start = 0;
  for (const j of cuts) {
    pieces.push({ start, end: inner[j].start });
    start = inner[j].end;
  }
  pieces.push({ start, end: total });
  return pieces;
}
