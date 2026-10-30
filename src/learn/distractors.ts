// Wrong answers that match the mistakes children really make. Never random.

import { skillOf, wrapHour } from './skills';

export type Misconception =
  | 'swap' // reads the hands the wrong way round (3:00 → 12:15)
  | 'swapHour' // reads the long hand's number as the hour (3:30 → 6:30)
  | 'nextHour' // hour hand is near the next number, so says that hour (3:30 → 4:30)
  | 'sameHourTo' // "quarter to" with the hour it's on, not the next one (3:45 → "quarter to 3" = 2:45)
  | 'ignoreMinute' // only looks at the short hand (3:30 → 3:00)
  | 'minuteNumber' // reads the numeral as minutes (3:15 → 3:03)
  | 'pastToFlip' // mixes up past and to (3:20 → 3:40)
  | 'offBy5' // counts one five too many or too few
  | 'neighbourHour' // misreads where the short hand points
  | 'upsideDown'; // 12 and 6 / turns the clock around

export interface TimeOption {
  h: number;
  m: number;
  reason?: Misconception;
}

/** Number the long hand points at (12 for :00). */
export function minuteHandNumber(m: number): number {
  return wrapHour(Math.round(m / 5) || 12);
}

/** All plausible mistakes for h:m, most likely first. */
export function misconceptionCandidates(h: number, m: number): TimeOption[] {
  const c: TimeOption[] = [];
  const add = (hh: number, mm: number, reason: Misconception) => c.push({ h: wrapHour(hh), m: mm, reason });
  const mh = minuteHandNumber(m);
  const swap = () => add(mh, (h % 12) * 5, 'swap');
  const swapHour = () => add(mh, m, 'swapHour');
  const minuteNumber = () => m % 5 === 0 && m !== 0 && add(h, m / 5, 'minuteNumber');
  const flip = () => m % 5 === 0 && m !== 0 && m !== 30 && add(h, 60 - m, 'pastToFlip');

  switch (skillOf(m)) {
    case 'oclock':
      swapHour(); // 3 o'clock → 12 o'clock
      add(h + 1, 0, 'neighbourHour');
      add(h - 1, 0, 'neighbourHour');
      add(h + 6, 0, 'upsideDown');
      swap();
      break;
    case 'half':
      add(h + 1, 30, 'nextHour'); // the classic: 3:30 read as 4:30
      add(h, 0, 'ignoreMinute');
      swapHour(); // half past 6
      add(h + 1, 0, 'ignoreMinute'); // "4 o'clock" — it's near 4
      minuteNumber(); // 3:06
      swap();
      add(h - 1, 30, 'neighbourHour');
      break;
    case 'qpast':
      minuteNumber(); // 3:03
      flip(); // quarter to → 3:45
      swap();
      add(h - 1, 15, 'neighbourHour');
      add(h + 1, 15, 'nextHour');
      swapHour();
      add(h, 0, 'ignoreMinute');
      break;
    case 'qto':
      add(h - 1, 45, 'sameHourTo'); // "quarter to 3" = 2:45
      add(h + 1, 45, 'nextHour'); // 4:45 — reading the hour hand as 4
      minuteNumber(); // 3:09
      flip(); // quarter past → 3:15
      swap();
      add(h + 1, 15, 'pastToFlip'); // "quarter past 4"
      break;
    case 'fivePast':
      minuteNumber();
      flip();
      add(h, m + 5, 'offBy5');
      add(h, m - 5, 'offBy5');
      add(h - 1, m, 'neighbourHour');
      swap();
      break;
    case 'fiveTo':
      add(h - 1, m, 'sameHourTo'); // "20 to 3" for 3:40 → 2:40
      add(h + 1, m, 'nextHour');
      minuteNumber();
      flip();
      add(h, m + 5, 'offBy5');
      add(h, m - 5, 'offBy5');
      break;
    case 'minutes': {
      const down = m - (m % 5);
      add(h, down, 'offBy5'); // stops at the 5 without counting on
      add(h, down + 5, 'offBy5');
      add(h, m + 1, 'offBy5');
      add(h, m - 1, 'offBy5');
      if (m > 30) add(h + 1, m, 'nextHour');
      else add(h, 60 - m, 'pastToFlip');
      break;
    }
  }
  return c;
}

/** Choose `count` wrong answers for h:m whose minutes are in `allowedMinutes`
 *  (so early levels only offer times she has learnt to say). */
export function pickDistractors(h: number, m: number, count: number, allowedMinutes?: number[]): TimeOption[] {
  const out: TimeOption[] = [];
  const seen = new Set([`${h}:${m}`]);
  const ok = (o: TimeOption) =>
    o.m >= 0 && o.m < 60 && o.h >= 1 && o.h <= 12 && (!allowedMinutes || allowedMinutes.includes(o.m)) && !seen.has(`${o.h}:${o.m}`);

  const pool = misconceptionCandidates(h, m);
  // Fallback: misreading the short hand by one is still a real mistake.
  pool.push({ h: wrapHour(h + 1), m, reason: 'neighbourHour' }, { h: wrapHour(h - 1), m, reason: 'neighbourHour' });
  if (allowedMinutes) for (const am of allowedMinutes) pool.push({ h, m: am, reason: 'ignoreMinute' });
  pool.push({ h: wrapHour(h + 2), m, reason: 'neighbourHour' });

  for (const o of pool) {
    if (out.length >= count) break;
    if (ok(o)) {
      out.push(o);
      seen.add(`${o.h}:${o.m}`);
    }
  }
  return out;
}

/** Number choices for "which number has the short hand just passed?" */
export function detectiveNumbers(h: number, m: number, count = 3): number[] {
  const out = [h];
  for (const n of [wrapHour(h + 1), minuteHandNumber(m), wrapHour(h - 1)]) {
    if (out.length < count && !out.includes(n)) out.push(n);
  }
  return out;
}
