// Pure clock maths. Angles are degrees clockwise from 12 o'clock.
// Time is kept as "total minutes" (a continuous number) so the hour hand is
// always derived from the minute hand, exactly like a real watch's gears.

export const MINUTES_PER_CYCLE = 12 * 60;

/** Wrap any minute count into 0..719. */
export function wrapMinutes(total: number): number {
  return ((total % MINUTES_PER_CYCLE) + MINUTES_PER_CYCLE) % MINUTES_PER_CYCLE;
}

/** Hours 1–12 and minutes 0–59 for a total-minute value. */
export function toHM(total: number): { h: number; m: number } {
  const t = wrapMinutes(Math.round(total));
  const h = Math.floor(t / 60);
  return { h: h === 0 ? 12 : h, m: t % 60 };
}

/** Total minutes (0..719) from an hour (1–12, or 0–23) and minute. */
export function fromHM(h: number, m: number): number {
  return wrapMinutes((h % 12) * 60 + m);
}

/** Hour hand angle: 30° per hour plus 0.5° per minute. Continuous (not wrapped). */
export function hourAngleFromMinutes(total: number): number {
  return total * 0.5;
}

/** Minute hand angle: 6° per minute. Continuous (not wrapped). */
export function minuteAngleFromMinutes(total: number): number {
  return total * 6;
}

export function normAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Angles (0..360) for the three hands at h:m:s. */
export function timeToAngles(h: number, m: number, s = 0) {
  const total = fromHM(h, m) + s / 60;
  return {
    hour: normAngle(hourAngleFromMinutes(total)),
    minute: normAngle(minuteAngleFromMinutes(total)),
    second: normAngle(s * 6),
  };
}

/** Angle of point (x, y) around centre (cx, cy), in screen coordinates (y down). */
export function pointToAngle(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return normAngle(deg);
}

/** Minute (0..59) that a minute-hand angle points at, snapped to `step` minutes. */
export function angleToMinute(angle: number, step = 1): number {
  const raw = normAngle(angle) / 6;
  return (Math.round(raw / step) * step) % 60;
}

/** Signed shortest difference b - a in degrees, in (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  const d = normAngle(b - a);
  return d > 180 ? d - 360 : d;
}

/** Point on a circle at `angle` (clock degrees) and radius r. */
export function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
