import { describe, expect, it } from 'vitest';
import { detectiveNumbers, misconceptionCandidates, pickDistractors } from './distractors';

const has = (list: { h: number; m: number }[], h: number, m: number) => list.some((o) => o.h === h && o.m === m);

describe('misconception-based wrong answers', () => {
  it('half past: offers the next-hour mistake (3:30 → 4:30)', () => {
    const d = pickDistractors(3, 30, 3, [0, 30]);
    expect(has(d, 4, 30)).toBe(true);
    expect(d.find((o) => o.h === 4 && o.m === 30)?.reason).toBe('nextHour');
  });

  it('quarter to: offers the same-hour mistake (3:45 → 2:45, "quarter to 3")', () => {
    const d = pickDistractors(3, 45, 3);
    expect(has(d, 2, 45)).toBe(true);
    expect(has(d, 4, 45)).toBe(true);
  });

  it('quarter past: offers minute numeral read as minutes (3:15 → 3:03)', () => {
    expect(has(pickDistractors(3, 15, 3), 3, 3)).toBe(true);
  });

  it("o'clock: offers swapped hands (3:00 → 12:00 when only o'clock allowed)", () => {
    const d = pickDistractors(3, 0, 2, [0]);
    expect(has(d, 12, 0)).toBe(true);
    expect(d.every((o) => o.m === 0)).toBe(true);
  });

  it('full hand swap appears when any minutes are allowed (3:00 → 12:15)', () => {
    expect(has(misconceptionCandidates(3, 0), 12, 15)).toBe(true);
  });

  it('every wrong answer has a misconception reason', () => {
    for (let h = 1; h <= 12; h++)
      for (const m of [0, 15, 30, 45, 5, 20, 40, 55, 7, 38]) {
        for (const o of pickDistractors(h, m, 3)) expect(o.reason).toBeTruthy();
      }
  });

  it('never includes the correct answer or duplicates, always valid, always enough', () => {
    for (let h = 1; h <= 12; h++)
      for (const [m, allowed] of [
        [0, [0]],
        [30, [0, 30]],
        [0, [0, 30]],
        [15, undefined],
        [45, undefined],
        [40, undefined],
        [7, undefined],
      ] as [number, number[] | undefined][]) {
        const d = pickDistractors(h, m, 3, allowed);
        expect(d).toHaveLength(3);
        const keys = d.map((o) => `${o.h}:${o.m}`);
        expect(new Set(keys).size).toBe(3);
        expect(keys).not.toContain(`${h}:${m}`);
        for (const o of d) {
          expect(o.h).toBeGreaterThanOrEqual(1);
          expect(o.h).toBeLessThanOrEqual(12);
          expect(o.m).toBeGreaterThanOrEqual(0);
          expect(o.m).toBeLessThan(60);
          if (allowed) expect(allowed).toContain(o.m);
        }
      }
  });

  it('wraps 12 → 1 for the next hour', () => {
    expect(has(pickDistractors(12, 30, 3, [0, 30]), 1, 30)).toBe(true);
  });
});

describe('detectiveNumbers', () => {
  it('includes the right hour, the next hour and the long-hand number', () => {
    expect(detectiveNumbers(3, 30).sort((a, b) => a - b)).toEqual([3, 4, 6]);
    expect(detectiveNumbers(12, 30)).toContain(1);
  });
});
