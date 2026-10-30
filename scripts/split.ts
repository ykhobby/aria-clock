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
const tens = (n: number) => (n <= 20 ? NUMBER_WORDS[n] : `twenty ${NUMBER_WORDS[n - 20]}`);

/** Words only, lower case, digits spelled out ("1/4 past 3" → "quarter past three"). */
export function normWords(s: string): string {
  return s
    .replace(/1\/4/g, 'quarter')
    .replace(/1\/2/g, 'half')
    .replace(/\d+/g, (n) => (Number(n) < 30 ? tens(Number(n)) : n))
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z]+/g, ' ')
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
