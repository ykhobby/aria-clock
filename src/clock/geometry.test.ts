import { describe, expect, it } from 'vitest';
import { angleToMinute, fromHM, pointToAngle, timeToAngles, toHM } from './geometry';

describe('timeToAngles', () => {
  it.each([
    [12, 0, 0, 0],
    [3, 0, 90, 0],
    [6, 0, 180, 0],
    [9, 0, 270, 0],
    [3, 30, 105, 180], // hour hand halfway between 3 (90°) and 4 (120°)
    [3, 15, 97.5, 90],
    [3, 45, 112.5, 270],
    [11, 59, 359.5, 354],
    [12, 30, 15, 180],
  ])('%i:%i → hour %f°, minute %f°', (h, m, hour, minute) => {
    const a = timeToAngles(h, m);
    expect(a.hour).toBeCloseTo(hour);
    expect(a.minute).toBeCloseTo(minute);
  });

  it('at half past, the hour hand is exactly between the two numbers', () => {
    for (let h = 1; h <= 12; h++) {
      const at = timeToAngles(h, 0).hour;
      const next = timeToAngles(h === 12 ? 1 : h + 1, 0).hour;
      const half = timeToAngles(h, 30).hour;
      const mid = h === 11 ? 345 : h === 12 ? 15 : (at + next) / 2;
      expect(half).toBeCloseTo(mid);
    }
  });

  it('second hand drifts the minute hand smoothly', () => {
    expect(timeToAngles(3, 0, 30).minute).toBeCloseTo(3);
    expect(timeToAngles(3, 0, 30).second).toBeCloseTo(180);
  });
});

describe('conversions', () => {
  it('toHM / fromHM round-trip and use 12 not 0', () => {
    expect(toHM(0)).toEqual({ h: 12, m: 0 });
    expect(toHM(fromHM(3, 30))).toEqual({ h: 3, m: 30 });
    expect(toHM(-10)).toEqual({ h: 11, m: 50 });
    expect(toHM(fromHM(15, 45))).toEqual({ h: 3, m: 45 });
  });

  it('pointToAngle uses clock directions (screen y down)', () => {
    expect(pointToAngle(0, 0, 0, -10)).toBeCloseTo(0); // up = 12
    expect(pointToAngle(0, 0, 10, 0)).toBeCloseTo(90); // right = 3
    expect(pointToAngle(0, 0, 0, 10)).toBeCloseTo(180); // down = 6
    expect(pointToAngle(0, 0, -10, 0)).toBeCloseTo(270); // left = 9
  });

  it('angleToMinute snaps', () => {
    expect(angleToMinute(93)).toBe(16);
    expect(angleToMinute(93, 5)).toBe(15);
    expect(angleToMinute(358, 5)).toBe(0);
  });
});
