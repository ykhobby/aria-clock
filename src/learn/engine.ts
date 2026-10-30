// Picks the next question and records answers. Pure functions so they can be tested.

import type { HandName } from '../clock/drag';
import { fromHM, toHM } from '../clock/geometry';
import { levelProgress, newLevelProgress, type Progress } from '../store';
import { detectiveNumbers, minuteHandNumber, pickDistractors, type TimeOption } from './distractors';
import { LEVELS, isPlayable, type LevelDef, type QuestionKind } from './levels';
import { LIFE_AMPM, LIFE_SET } from './life';
import { skillOf, timeKey, wrapHour, type Skill } from './skills';

export type Rng = () => number;

export const REVIEW_RATE = 0.2;
export const HELPER_STREAK = 3;
export const WARMUP_STREAK = 5;
export const WINDOW = 10;

export interface Question {
  key: string;
  kind: QuestionKind;
  level: number;
  review: boolean;
  warmup: boolean;
  h: number;
  m: number;
  skill: Skill | 'meet';
  options?: TimeOption[];
  numbers?: number[];
  hand?: HandName;
  number?: number;
  /** Set questions: where the hands start. */
  start?: number;
  hourOnly?: boolean;
  snap?: number;
  wordsOnly: boolean;
  /** Match: the times to pair (the first is h:m). */
  pairs?: TimeOption[];
  /** Count by 5s: minute choices. */
  counts?: number[];
  /** Time shown on the clock when it differs from the answer (life-plus). */
  clock?: number;
  /** Life-plus: minutes added (60 or 30). */
  plus?: number;
  /** Life questions: which scenario. */
  scenario?: string;
  ampm?: 'morning' | 'afternoon';
}

const pick = <T,>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length) % arr.length];

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick<T>(items: { item: T; weight: number }[], rng: Rng): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const x of items) {
    r -= x.weight;
    if (r <= 0) return x.item;
  }
  return items[items.length - 1].item;
}

/** Error rate for a skill from recent answers (0 when there's no data). */
export function skillErrorRate(p: Progress, s: Skill): number {
  const r = p.skills[s]?.recent ?? [];
  return r.length ? r.filter((x) => !x).length / r.length : 0;
}

function levelSkills(l: LevelDef): Skill[] {
  return [...new Set(l.minutes.map(skillOf))];
}

/** Earlier level to review, weighted toward skills she has got wrong. */
export function pickReviewLevel(p: Progress, rng: Rng): LevelDef | null {
  const earlier = LEVELS.filter((l) => l.playable && l.id < p.current);
  if (!earlier.length) return null;
  return weightedPick(
    earlier.map((l) => {
      const err = l.id === 0 ? 0 : Math.max(...levelSkills(l).map((s) => skillErrorRate(p, s)));
      return { item: l, weight: 1 + 4 * err };
    }),
    rng,
  );
}

function pickTime(l: LevelDef, p: Progress, rng: Rng, preferMissed: boolean): { h: number; m: number } {
  if (preferMissed && rng() < 0.5) {
    const missed = Object.entries(p.missed)
      .map(([k, n]) => {
        const [h, m] = k.split(':').map(Number);
        return { h, m, n };
      })
      .filter((t) => l.minutes.includes(t.m));
    if (missed.length) {
      const t = weightedPick(missed.map((t) => ({ item: t, weight: t.n })), rng);
      return { h: t.h, m: t.m };
    }
  }
  return { h: 1 + Math.floor(rng() * 12), m: pick(l.minutes, rng) };
}

export function makeQuestion(l: LevelDef, p: Progress, rng: Rng, flags: { review?: boolean; warmup?: boolean } = {}): Question {
  const kind = pick(l.kinds, rng);
  let { h, m } = pickTime(l, p, rng, !!flags.review);
  const base = { kind, level: l.id, review: !!flags.review, warmup: !!flags.warmup, wordsOnly: !!l.wordsOnly };

  switch (kind) {
    case 'meet-hand': {
      // An o'clock time where the hands are clearly apart.
      h = 2 + Math.floor(rng() * 9);
      const hand: HandName = rng() < 0.5 ? 'hour' : 'minute';
      return { ...base, key: `hand-${hand}-${h}`, h, m: 0, skill: 'meet', hand };
    }
    case 'meet-number': {
      const number = 1 + Math.floor(rng() * 12);
      return { ...base, key: `num-${number}`, h: 10, m: 10, skill: 'meet', number };
    }
    case 'detective':
      // Keep the long hand away from the short hand so there's only one hand to look at.
      if ([h, wrapHour(h + 1)].includes(minuteHandNumber(m))) h = wrapHour(h + 4);
      return { ...base, key: `det-${timeKey(h, m)}`, h, m, skill: skillOf(m), numbers: shuffle(detectiveNumbers(h, m), rng) };
    case 'count5': {
      if (m % 5 !== 0 || m === 0) m = 5 * (1 + Math.floor(rng() * 11));
      // The right count, the numeral itself, and one five out either way.
      const counts = [m, m / 5, m + 5, m - 5, m + 10].filter((x, i, a) => x > 0 && x < 60 && a.indexOf(x) === i).slice(0, 4);
      return { ...base, key: `count-${m}`, h, m, skill: skillOf(m), counts: shuffle(counts, rng) };
    }
    case 'match': {
      // Three times that are easy to mix up, e.g. quarter past and quarter to.
      const others = pickDistractors(h, m, 2, l.answerMinutes);
      return { ...base, key: `match-${timeKey(h, m)}`, h, m, skill: skillOf(m), pairs: [{ h, m }, ...others] };
    }
    case 'type':
      return { ...base, key: `type-${timeKey(h, m)}`, h, m, skill: skillOf(m) };
    case 'life-set': {
      const sc = pick(LIFE_SET, rng);
      let sh = wrapHour(sc.h + 3 + Math.floor(rng() * 6));
      if (sh === sc.h) sh = wrapHour(sc.h + 4);
      return { ...base, key: `life-set-${sc.id}`, h: sc.h, m: sc.m, skill: skillOf(sc.m), scenario: sc.id, start: fromHM(sh, 0), snap: 5 };
    }
    case 'life-plus': {
      const plus = rng() < 0.6 ? 60 : 30;
      const start = fromHM(h, m);
      const opt = (mins: number) => toHM(mins);
      const ans = opt(start + plus);
      // Real slips: forgetting to move on, going too far, going backwards.
      const wrong = [opt(start), opt(start + 2 * plus), opt(start - plus)];
      const options = [ans, ...wrong].filter((o, i, a) => a.findIndex((x) => x.h === o.h && x.m === o.m) === i);
      return { ...base, key: `life-plus-${timeKey(h, m)}-${plus}`, h: ans.h, m: ans.m, skill: skillOf(ans.m), clock: start, plus, options: shuffle(options, rng) };
    }
    case 'life-ampm': {
      const sc = pick(LIFE_AMPM, rng);
      return { ...base, key: `life-ampm-${sc.id}`, h: sc.h, m: sc.m, skill: 'meet', scenario: sc.id, ampm: sc.ampm };
    }
    case 'set': {
      // Start somewhere else, on a time she already knows how to say.
      let sh = wrapHour(h + 2 + Math.floor(rng() * 8));
      if (sh === h) sh = wrapHour(h + 3);
      return {
        ...base,
        key: `set-${timeKey(h, m)}`,
        h,
        m,
        skill: skillOf(m),
        start: fromHM(sh, 0),
        hourOnly: !!l.hourOnly,
        snap: l.setSnap ?? 1,
      };
    }
    case 'read':
    default: {
      const wrong = pickDistractors(h, m, l.options - 1, l.answerMinutes);
      return { ...base, kind: 'read', key: `read-${timeKey(h, m)}`, h, m, skill: skillOf(m), options: shuffle([{ h, m }, ...wrong], rng) };
    }
  }
}

/** Next question: mostly the current level, about 20% review from earlier ones. */
export function nextQuestion(p: Progress, rng: Rng = Math.random, ctx: { last?: Question; warmup?: boolean } = {}): Question {
  const cur = LEVELS[p.current];
  let q: Question | null = null;
  for (let tries = 0; tries < 6; tries++) {
    if (ctx.warmup) {
      const easier = LEVELS[Math.max(0, p.current - 1)];
      q = makeQuestion(easier, p, rng, { warmup: true });
    } else if (rng() < REVIEW_RATE) {
      const r = pickReviewLevel(p, rng);
      q = r ? makeQuestion(r, p, rng, { review: true }) : makeQuestion(cur, p, rng);
    } else {
      q = makeQuestion(cur, p, rng);
    }
    if (q.key !== ctx.last?.key) break;
  }
  return q!;
}

export function hasMastered(recent: boolean[], threshold: number): boolean {
  return recent.length >= WINDOW && recent.slice(-WINDOW).filter(Boolean).length >= threshold;
}

export interface AnswerEvents {
  helpersOn?: boolean;
  offerWarmup?: boolean;
  /** Level just cleared, and the next one (null when no more levels yet). */
  levelUp?: { cleared: number; next: number | null };
}

/** Record an answer. `given` is the time she chose or set, if any. */
export function recordAnswer(p: Progress, q: Question, correct: boolean): { progress: Progress; events: AnswerEvents } {
  const next: Progress = structuredClone(p);
  const events: AnswerEvents = {};
  if (correct) next.stars += 1;

  if (q.skill !== 'meet') {
    const s = next.skills[q.skill];
    if (correct) s.right++;
    else s.wrong++;
    s.recent = [...s.recent, correct].slice(-20);
    if (!correct) {
      const k = timeKey(q.h, q.m);
      next.missed[k] = (next.missed[k] ?? 0) + 1;
    }
  }

  // Only questions from the level she's on count toward moving up or helpers.
  if (!q.review && !q.warmup && q.level === next.current) {
    const lp = { ...levelProgress(next, q.level) };
    lp.answered++;
    lp.recent = [...lp.recent, correct].slice(-WINDOW);
    if (correct) {
      lp.wrongStreak = 0;
      lp.helper = Math.max(0, lp.helper - 0.25);
    } else {
      lp.wrongStreak++;
      if (lp.wrongStreak >= HELPER_STREAK && lp.helper < 1) {
        lp.helper = 1;
        events.helpersOn = true;
      }
      if (lp.wrongStreak >= WARMUP_STREAK && !lp.warmupOffered) {
        lp.warmupOffered = true;
        events.offerWarmup = true;
      }
    }
    next.levels[q.level] = lp;

    if (hasMastered(lp.recent, next.settings.mastery) && !next.stickers.includes(q.level)) {
      next.stickers.push(q.level);
      const up = q.level + 1;
      const playable = isPlayable(up);
      if (playable) {
        next.level = Math.max(next.level, up);
        next.current = up;
        next.levels[up] = next.levels[up] ?? newLevelProgress();
      }
      events.levelUp = { cleared: q.level, next: playable ? up : null };
    }
  }
  return { progress: next, events };
}

/** After a warm-up round: fresh start on the streak, helpers stay on. */
export function afterWarmup(p: Progress): Progress {
  const next = structuredClone(p);
  const lp = { ...levelProgress(next, next.current), wrongStreak: 0, helper: 1 };
  next.levels[next.current] = lp;
  return next;
}

export function checkSet(q: Question, setMinutes: number): boolean {
  return Math.round(setMinutes) % 720 === fromHM(q.h, q.m);
}
