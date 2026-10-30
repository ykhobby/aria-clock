import { describe, expect, it } from 'vitest';
import { dragTo, pickHand, snapMinutes, startDrag } from './drag';
import { fromHM, timeToAngles, toHM } from './geometry';

/** Drag a hand through a list of finger angles. */
function sweep(hand: 'hour' | 'minute', h: number, m: number, angles: number[]) {
  let s = startDrag(hand, fromHM(h, m));
  for (const a of angles) s = dragTo(s, a);
  return toHM(snapMinutes(s.minutes));
}

describe('minute hand drag', () => {
  it('3:50 → 4:10 when the minute hand sweeps forward past 12', () => {
    expect(sweep('minute', 3, 50, [310, 330, 350, 10, 30, 50, 60])).toEqual({ h: 4, m: 10 });
  });

  it('4:10 → 3:50 when it sweeps back past 12', () => {
    expect(sweep('minute', 4, 10, [50, 30, 10, 350, 330, 310, 300])).toEqual({ h: 3, m: 50 });
  });

  it('two full turns forward add two hours', () => {
    const angles: number[] = [];
    for (let a = 20; a <= 720; a += 20) angles.push(a % 360);
    expect(sweep('minute', 3, 0, angles)).toEqual({ h: 5, m: 0 });
  });

  it('the hour hand follows the minute hand while dragging', () => {
    let s = startDrag('minute', fromHM(3, 0));
    for (const a of [30, 60, 90, 120, 150, 180]) s = dragTo(s, a);
    const { h, m } = toHM(s.minutes);
    expect({ h, m }).toEqual({ h: 3, m: 30 });
    expect(timeToAngles(h, m).hour).toBeCloseTo(105);
  });

  it('first touch swings the hand the short way to the finger', () => {
    // minute at 12, finger at the 11 → goes back 5 minutes, not forward 55
    expect(sweep('minute', 4, 0, [330])).toEqual({ h: 3, m: 55 });
  });
});

describe('hour hand drag', () => {
  it('moves time by 2 minutes per degree, minute hand turning with it', () => {
    expect(sweep('hour', 3, 0, [105])).toEqual({ h: 3, m: 30 });
  });

  it('snaps to whole hours when the minute hand is locked at 12', () => {
    let s = startDrag('hour', fromHM(3, 0));
    for (const a of [100, 130, 145]) s = dragTo(s, a);
    expect(toHM(snapMinutes(s.minutes, 60))).toEqual({ h: 5, m: 0 });
  });
});

describe('pickHand', () => {
  const both = { hour: true, minute: true };
  it('picks the hand pointing nearest the finger', () => {
    // 3:00 — hour points at 90°, minute at 0°
    expect(pickHand(85, 0.4, fromHM(3, 0), both)).toBe('hour');
    expect(pickHand(10, 0.4, fromHM(3, 0), both)).toBe('minute');
  });
  it('uses distance from centre when hands overlap', () => {
    // 12:00 — both point up
    expect(pickHand(0, 0.3, fromHM(12, 0), both)).toBe('hour');
    expect(pickHand(0, 0.8, fromHM(12, 0), both)).toBe('minute');
  });
  it('respects locked hands', () => {
    expect(pickHand(0, 0.9, fromHM(12, 0), { hour: true, minute: false })).toBe('hour');
  });
});
