// The time "skills" tracked for accuracy, independent of level.

export type Skill = 'oclock' | 'half' | 'qpast' | 'qto' | 'fivePast' | 'fiveTo' | 'minutes';

export const SKILLS: Skill[] = ['oclock', 'half', 'qpast', 'qto', 'fivePast', 'fiveTo', 'minutes'];

export const SKILL_LABELS: Record<Skill, string> = {
  oclock: "O'clock",
  half: 'Half past',
  qpast: 'Quarter past',
  qto: 'Quarter to',
  fivePast: '5-minute past',
  fiveTo: '5-minute to',
  minutes: 'To the minute',
};

export function skillOf(m: number): Skill {
  if (m === 0) return 'oclock';
  if (m === 30) return 'half';
  if (m === 15) return 'qpast';
  if (m === 45) return 'qto';
  if (m % 5 === 0) return m < 30 ? 'fivePast' : 'fiveTo';
  return 'minutes';
}

/** Wrap an hour into 1–12. */
export function wrapHour(h: number): number {
  return ((((h - 1) % 12) + 12) % 12) + 1;
}

export function timeKey(h: number, m: number): string {
  return `${h}:${String(m).padStart(2, '0')}`;
}
