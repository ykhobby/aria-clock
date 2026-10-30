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

/** "3 o'clock", "half past 3", "quarter to 4", "20 past 3", "7 minutes to 4". */
export function timeToWords(h: number, m: number): string {
  if (m === 0) return `${h} o'clock`;
  if (m === 15) return `quarter past ${h}`;
  if (m === 30) return `half past ${h}`;
  if (m === 45) return `quarter to ${nextHour(h)}`;
  if (m < 30) return m % 5 === 0 ? `${m} past ${h}` : `${m} ${m === 1 ? 'minute' : 'minutes'} past ${h}`;
  const to = 60 - m;
  return to % 5 === 0 ? `${to} to ${nextHour(h)}` : `${to} ${to === 1 ? 'minute' : 'minutes'} to ${nextHour(h)}`;
}

/** Same phrase with numbers as words, so speech engines say "twenty past three". */
export function timeToSpeech(h: number, m: number): string {
  return timeToWords(h, m).replace(/\d+/g, (n) => NUMBER_WORDS[Number(n)] ?? n);
}

/** "3:05" */
export function timeToDigital(h: number, m: number): string {
  return `${h}:${String(m).padStart(2, '0')}`;
}
