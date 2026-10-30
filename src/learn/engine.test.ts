import { describe, expect, it } from 'vitest';
import { newProgress, type Progress } from '../store';
import { checkSet, hasMastered, makeQuestion, nextQuestion, recordAnswer, type Question } from './engine';
import { LEVELS } from './levels';
import { fromHM } from '../clock/geometry';

/** Small seeded RNG so tests are repeatable. */
function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function answerMany(p: Progress, results: boolean[]) {
  const r = rng(7);
  let events = {};
  for (const ok of results) {
    const q: Question = { ...makeQuestion(LEVELS[p.current], p, r), review: false };
    const out = recordAnswer(p, q, ok);
    p = out.progress;
    events = out.events;
  }
  return { p, events };
}

describe('mastery', () => {
  it('needs 8 of the last 10', () => {
    expect(hasMastered([true, true, true, true, true, true, true, true], 8)).toBe(false); // only 8 answered
    expect(hasMastered([false, false, true, true, true, true, true, true, true, true], 8)).toBe(true);
    expect(hasMastered([false, false, false, true, true, true, true, true, true, true], 8)).toBe(false);
  });

  it('moves up a level and earns a sticker at the threshold', () => {
    const { p, events } = answerMany(newProgress(), [false, false, ...Array(8).fill(true)]);
    expect(p.level).toBe(1);
    expect(p.current).toBe(1);
    expect(p.stickers).toEqual([0]);
    expect(events).toMatchObject({ levelUp: { cleared: 0, next: 1 } });
  });

  it('respects an adjusted threshold', () => {
    const start = newProgress();
    start.settings.mastery = 10;
    expect(answerMany(start, [false, ...Array(9).fill(true)]).p.level).toBe(0);
    expect(answerMany(start, Array(10).fill(true)).p.level).toBe(1);
  });

  it('review questions do not count toward moving up', () => {
    let p = newProgress();
    p.current = p.level = 2;
    const q = { ...makeQuestion(LEVELS[1], p, rng()), review: true };
    for (let i = 0; i < 12; i++) p = recordAnswer(p, q, true).progress;
    expect(p.level).toBe(2);
    expect(p.skills.oclock.right).toBe(12);
  });

  it('never drops a level', () => {
    let p = newProgress();
    p.current = p.level = 3;
    p = answerMany(p, Array(15).fill(false)).p;
    expect(p.level).toBe(3);
    expect(p.current).toBe(3);
  });
});

describe('helpers', () => {
  it('turn on after 3 wrong in a row and fade with correct answers', () => {
    let { p, events } = answerMany(newProgress(), [false, false]);
    expect(p.levels[0].helper).toBe(0);
    ({ p, events } = answerMany(p, [false]));
    expect(events).toMatchObject({ helpersOn: true });
    expect(p.levels[0].helper).toBe(1);
    ({ p } = answerMany(p, [true, true]));
    expect(p.levels[0].helper).toBe(0.5);
    ({ p } = answerMany(p, [true, true]));
    expect(p.levels[0].helper).toBe(0);
  });

  it('offers a warm-up (once) if still struggling', () => {
    const { p, events } = answerMany(newProgress(), [false, false, false, false, false]);
    expect(events).toMatchObject({ offerWarmup: true });
    expect(answerMany(p, [false]).events).not.toHaveProperty('offerWarmup');
  });
});

describe('question picking', () => {
  it('about 20% of questions are review from earlier levels', () => {
    const p = newProgress();
    p.current = p.level = 6;
    const r = rng(3);
    let review = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) if (nextQuestion(p, r).review) review++;
    expect(review / N).toBeGreaterThan(0.15);
    expect(review / N).toBeLessThan(0.25);
  });

  it('review leans toward skills she gets wrong', () => {
    const p = newProgress();
    p.current = p.level = 6;
    p.skills.half.recent = Array(10).fill(false); // struggling with half past
    p.skills.oclock.recent = Array(10).fill(true);
    const r = rng(5);
    let half = 0;
    let oclock = 0;
    for (let i = 0; i < 3000; i++) {
      const q = nextQuestion(p, r);
      if (!q.review) continue;
      if (q.skill === 'half') half++;
      if (q.skill === 'oclock') oclock++;
    }
    expect(half).toBeGreaterThan(oclock);
  });

  it('review picks missed times more often', () => {
    const p = newProgress();
    p.current = p.level = 4;
    p.missed = { '7:30': 5 };
    const r = rng(11);
    let hits = 0;
    let reviews = 0;
    for (let i = 0; i < 3000; i++) {
      const q = nextQuestion(p, r);
      if (q.review && q.level === 3) {
        reviews++;
        if (q.h === 7 && q.m === 30) hits++;
      }
    }
    expect(hits / reviews).toBeGreaterThan(0.3); // vs 1/12 by chance
  });

  it('level 0 never reviews; level 1 questions are always o\'clock', () => {
    const p = newProgress();
    const r = rng(2);
    for (let i = 0; i < 200; i++) expect(nextQuestion(p, r).review).toBe(false);
    p.current = p.level = 1;
    for (let i = 0; i < 200; i++) {
      const q = nextQuestion(p, r);
      if (q.level === 1) expect(q.options!.every((o) => o.m === 0)).toBe(true);
    }
  });

  it('read questions include the right answer exactly once', () => {
    const p = newProgress();
    const r = rng(9);
    for (const l of LEVELS.filter((l) => l.playable && l.kinds.includes('read'))) {
      for (let i = 0; i < 50; i++) {
        const q = makeQuestion(l, p, r);
        if (q.kind !== 'read') continue;
        expect(q.options).toHaveLength(l.options);
        expect(q.options!.filter((o) => o.h === q.h && o.m === q.m)).toHaveLength(1);
      }
    }
  });

  it('set questions never start on the answer', () => {
    const p = newProgress();
    const r = rng(4);
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(LEVELS[2], p, r);
      expect(q.start).not.toBe(fromHM(q.h, q.m));
      expect(checkSet(q, fromHM(q.h, q.m))).toBe(true);
    }
  });
});

describe('detective questions', () => {
  it('never put the long hand on the hour or the next hour', () => {
    const p = newProgress();
    const r = rng(13);
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion(LEVELS[4], p, r);
      const mh = Math.round(q.m / 5) || 12;
      expect([q.h, (q.h % 12) + 1]).not.toContain(mh);
    }
  });
});

describe('later question kinds', () => {
  const p = newProgress();
  const r = rng(21);
  const many = (id: number, kind: string) => {
    const out: Question[] = [];
    for (let i = 0; i < 600 && out.length < 60; i++) {
      const q = makeQuestion(LEVELS[id], p, r);
      if (q.kind === kind) out.push(q);
    }
    return out;
  };

  it('count by 5s offers the right count and the numeral-as-minutes mistake', () => {
    const qs = many(10, 'count5');
    expect(qs.length).toBeGreaterThan(10);
    for (const q of qs) {
      expect(q.counts).toContain(q.m);
      expect(new Set(q.counts).size).toBe(q.counts!.length);
      expect(q.counts!.every((c) => c > 0 && c < 60)).toBe(true);
      if (q.m / 5 > 0) expect(q.counts).toContain(q.m / 5);
    }
  });

  it('match uses three different, easily confused times', () => {
    for (const q of many(9, 'match')) {
      expect(q.pairs).toHaveLength(3);
      expect(new Set(q.pairs!.map((x) => `${x.h}:${x.m}`)).size).toBe(3);
      expect(q.pairs![0]).toEqual({ h: q.h, m: q.m });
    }
  });

  it('"in one hour" adds the hour and keeps the right answer among the options', () => {
    for (const q of many(15, 'life-plus')) {
      expect(q.options!.filter((o) => o.h === q.h && o.m === q.m)).toHaveLength(1);
      expect(fromHM(q.h, q.m)).toBe((q.clock! + q.plus!) % 720);
    }
  });

  it('real-life set and morning/afternoon questions come from her day', () => {
    for (const q of many(15, 'life-set')) expect(q.scenario).toBeTruthy();
    for (const q of many(15, 'life-ampm')) expect(['morning', 'afternoon']).toContain(q.ampm);
  });

  it('every level has a narrated intro and is playable', () => {
    for (const l of LEVELS) {
      expect(l.playable).toBe(true);
      expect(l.intro.length).toBeGreaterThan(0);
    }
  });
});
