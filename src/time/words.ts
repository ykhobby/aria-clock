// Time phrases the way Australian primary schools teach them.

export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three',
  'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

/** 0–59 as words: "thirty-five". */
export function numberWord(n: number): string {
  if (n < 30) return NUMBER_WORDS[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${NUMBER_WORDS[n % 10]}` : t;
}

export function nextHour(h: number): number {
  return h === 12 ? 1 : h + 1;
}

/** Minutes said the way people read a digital clock: "oh seven", "thirty-one". */
function digitalMinutes(m: number): string {
  return m < 10 ? `oh ${NUMBER_WORDS[m]}` : numberWord(m);
}

/** "3 o'clock", "half past 3", "quarter to 4", "20 past 3" for times on a five,
 *  as schools teach them. Other minutes are said like a digital clock:
 *  "3 thirty-one", "3 oh 7" (nobody says "twenty-nine minutes to four"). */
export function timeToWords(h: number, m: number): string {
  if (m === 0) return `${h} o'clock`;
  if (m === 15) return `quarter past ${h}`;
  if (m === 30) return `half past ${h}`;
  if (m === 45) return `quarter to ${nextHour(h)}`;
  if (m % 5 !== 0) return m < 10 ? `${h} oh ${m}` : `${h} ${numberWord(m)}`;
  return m < 30 ? `${m} past ${h}` : `${60 - m} to ${nextHour(h)}`;
}

/** Same phrase with numbers as words, so speech engines say "twenty past three". */
export function timeToSpeech(h: number, m: number): string {
  if (m % 5 !== 0) return `${NUMBER_WORDS[h]} ${digitalMinutes(m)}`;
  return timeToWords(h, m).replace(/\d+/g, (n) => NUMBER_WORDS[Number(n)] ?? n);
}

/** "3:05" */
export function timeToDigital(h: number, m: number): string {
  return `${h}:${String(m).padStart(2, '0')}`;
}
