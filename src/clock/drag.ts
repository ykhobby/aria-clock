// Dragging the hands. A drag only ever adds the small angle the finger moved
// since the last event, so sweeping the minute hand past 12 carries the hour
// forward (or back) just like winding a real watch's crown.

import { angleDelta, hourAngleFromMinutes, minuteAngleFromMinutes, normAngle } from './geometry';

export type HandName = 'hour' | 'minute';

export interface DragState {
  hand: HandName;
  minutes: number; // continuous total minutes
  lastAngle: number; // last finger angle seen
}

/** Begin a drag. The hand's current angle is used as the start, so the first
 *  move swings the hand the short way round to the finger. */
export function startDrag(hand: HandName, minutes: number): DragState {
  const angle = hand === 'minute' ? minuteAngleFromMinutes(minutes) : hourAngleFromMinutes(minutes);
  return { hand, minutes, lastAngle: normAngle(angle) };
}

/** Move the dragged hand to point at `fingerAngle`. */
export function dragTo(state: DragState, fingerAngle: number): DragState {
  const d = angleDelta(state.lastAngle, fingerAngle);
  // Minute hand: 6° per minute. Hour hand: 0.5° per minute (so 1° = 2 minutes).
  const dMinutes = state.hand === 'minute' ? d / 6 : d * 2;
  return { ...state, minutes: state.minutes + dMinutes, lastAngle: normAngle(fingerAngle) };
}

/** Snap continuous minutes to a whole step (1, 5, 15, 30 or 60). */
export function snapMinutes(minutes: number, step = 1): number {
  return Math.round(minutes / step) * step;
}

/** Which hand did the finger mean? Picks the hand whose direction is closest;
 *  when both hands point the same way, the distance from the centre decides
 *  (the short hand is near the middle, the long hand near the edge). */
export function pickHand(
  fingerAngle: number,
  fingerRadius: number, // as a fraction of dial radius
  minutes: number,
  allowed: { hour: boolean; minute: boolean },
): HandName | null {
  if (allowed.hour && !allowed.minute) return 'hour';
  if (allowed.minute && !allowed.hour) return 'minute';
  if (!allowed.hour && !allowed.minute) return null;
  const dh = Math.abs(angleDelta(hourAngleFromMinutes(minutes), fingerAngle));
  const dm = Math.abs(angleDelta(minuteAngleFromMinutes(minutes), fingerAngle));
  if (dh < 30 && dm < 30) return fingerRadius < 0.55 ? 'hour' : 'minute';
  return dh < dm ? 'hour' : 'minute';
}
