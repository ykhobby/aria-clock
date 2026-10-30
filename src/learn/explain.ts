// Short, warm explanations after a wrong answer, plus praise lines.
// Each returns a sequence of recorded voice clips (see voice/lines.ts).

import type { HandName } from '../clock/drag';
import { toHM } from '../clock/geometry';
import { nextHour } from '../time/words';
import { V, type Line } from '../voice/lines';
import { minuteHandNumber, misconceptionCandidates, type TimeOption } from './distractors';
import type { Question } from './engine';

export interface Explanation {
  say: Line[];
  highlight: HandName | 'both' | null;
  hourSector?: boolean;
  highlightNumber?: number;
  fives?: boolean;
}

const pickLine = (lines: Line[], rng = Math.random) => lines[Math.floor(rng() * lines.length)];
export const praise = (rng = Math.random) => pickLine(V.praise, rng);
const gentle = (rng = Math.random) => pickLine(V.gentle, rng);

/** What the long hand shows, said simply. */
function minuteHint(m: number): Line {
  if (m === 0) return V.longOn12;
  if (m === 30) return V.longOn6;
  if (m === 15) return V.longOn3;
  if (m === 45) return V.longOn9;
  if (m % 5 === 0) return V.longCount(minuteHandNumber(m));
  return V.countMarks;
}

function hourHint(h: number, m: number): Line {
  if (m === 0) return V.shortPointsTo(h);
  // "to" times (on a five) use the next hour; odd minutes are said digitally, with this hour.
  if (m > 30 && m % 5 === 0) return V.shortNearly(nextHour(h));
  return V.shortJustPast(h);
}

export function explainRead(q: Question, chosen: TimeOption): Explanation {
  const { h, m } = q;
  const answer = [V.itsTime(h, m)];
  switch (chosen.reason) {
    case 'swap':
    case 'swapHour':
      return { say: [gentle(), V.shortTellsHour, hourHint(h, m), ...answer], highlight: 'hour', hourSector: m !== 0 };
    case 'nextHour':
      return { say: [gentle(), V.shortJustPast(h), V.shortNotReached(nextHour(h)), ...answer], highlight: 'hour', hourSector: true };
    case 'sameHourTo':
      return { say: [gentle(), V.toUsesNext, hourHint(h, m), ...answer], highlight: 'hour', hourSector: true };
    case 'ignoreMinute':
    case 'minuteNumber':
    case 'pastToFlip':
    case 'offBy5':
      return { say: [gentle(), minuteHint(m), ...answer], highlight: 'minute' };
    default:
      return { say: [gentle(), hourHint(h, m), ...answer], highlight: 'hour', hourSector: m !== 0 };
  }
}

export function explainSet(q: Question, setMinutes: number): Explanation {
  const got = toHM(setMinutes);
  const answer = [V.thisIsTime(q.h, q.m)];
  if (got.m !== q.m) {
    const where =
      q.m === 0 ? V.longGoes12 : q.m === 30 ? V.longGoes6 : q.m % 5 === 0 ? V.longGoesOn(q.m / 5) : V.countMarks; // between numbers: count the little marks
    return { say: [gentle(), where, ...answer], highlight: 'minute' };
  }
  const where = q.m === 0 ? V.shortGoesOn(q.h) : V.shortGoesPast(q.h);
  return { say: [gentle(), where, ...answer], highlight: 'hour', hourSector: q.m !== 0, highlightNumber: q.h };
}

export function explainDetective(q: Question): Explanation {
  return {
    say: [gentle(), V.shortJustPast(q.h), V.shortNotReached(nextHour(q.h)), V.hourIs(q.h)],
    highlight: 'hour',
    hourSector: true,
    highlightNumber: q.h,
  };
}

export function explainMeetHand(q: Question): Explanation {
  return q.hand === 'hour' ? { say: [gentle(), V.thisShort], highlight: 'hour' } : { say: [gentle(), V.thisLong], highlight: 'minute' };
}

export function explainMeetNumber(q: Question): Explanation {
  return { say: [gentle(), V.hereNumber(q.number!)], highlight: null, highlightNumber: q.number };
}

export function explainCount5(q: Question): Explanation {
  return { say: [gentle(), V.longCount(minuteHandNumber(q.m))], highlight: 'minute', fives: true };
}

/** Typed the wrong time: explain the mistake it looks like. */
export function explainType(q: Question, typed: { h: number; m: number }): Explanation {
  const known = misconceptionCandidates(q.h, q.m).find((c) => c.h === typed.h && c.m === typed.m);
  if (known) return explainRead(q, known);
  // Not a known slip: point at whichever hand was misread.
  return typed.h !== q.h ? explainRead(q, { ...typed, reason: 'neighbourHour' }) : explainRead(q, { ...typed, reason: 'offBy5' });
}

export function explainMatch(): Explanation {
  return { say: [gentle(), V.matchHint], highlight: null };
}

export function explainPlus(q: Question): Explanation {
  return { say: [gentle(), V.plusHint(q.plus!), V.willBeTime(q.h, q.m)], highlight: q.plus === 60 ? 'hour' : 'minute' };
}

export function explainAmpm(q: Question): Explanation {
  return { say: [gentle(), q.ampm === 'morning' ? V.morningHint : V.afternoonHint], highlight: null };
}
