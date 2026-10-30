// Where the dial sits inside public/watch.png, in photo pixels.
// r is the radius of the dark crystal ring around the white dial.

export interface Calibration {
  cx: number;
  cy: number;
  r: number;
}

export const PHOTO_SIZE = 1000;

/** Measured from Aria's watch photo. */
export const DEFAULT_CALIBRATION: Calibration = { cx: 501, cy: 500.5, r: 115.5 };

const KEY = 'aria-clock:v1:calibration';

export function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if ([c.cx, c.cy, c.r].every((n) => typeof n === 'number' && Number.isFinite(n)) && c.r > 20) return c;
    }
  } catch {
    /* storage unavailable — use the default */
  }
  return DEFAULT_CALIBRATION;
}

export function saveCalibration(c: Calibration): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function hasSavedCalibration(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
