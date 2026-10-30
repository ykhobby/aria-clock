// Aria's progress, saved in localStorage under one versioned key.

import { SKILLS, type Skill } from './learn/skills';

export type AnswerFormat = 'words' | 'digital' | 'both';

export interface Settings {
  answerFormat: AnswerFormat;
  /** Correct answers needed out of the last 10 to move up. */
  mastery: number;
  voice: boolean;
  sessionMinutes: number;
}

export interface LevelProgress {
  recent: boolean[]; // last 10 answers at this level (newest last)
  answered: number;
  wrongStreak: number;
  /** Helper strength 0–1: turned on after 3 wrong in a row, fades with correct answers. */
  helper: number;
  warmupOffered: boolean;
}

export interface SkillStats {
  right: number;
  wrong: number;
  recent: boolean[]; // last 20
}

export interface SessionLog {
  start: number;
  end: number;
  answered: number;
  correct: number;
  levels: number[];
}

export interface Progress {
  version: 1;
  /** Highest level unlocked. */
  level: number;
  /** Level being played (can be an earlier one she chose on the map). */
  current: number;
  levels: Record<number, LevelProgress>;
  skills: Record<Skill, SkillStats>;
  /** Times she's got wrong, e.g. { "3:45": 2 } */
  missed: Record<string, number>;
  stars: number;
  /** Level ids cleared (each gives a sticker). */
  stickers: number[];
  introSeen: number[];
  sessions: SessionLog[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { answerFormat: 'both', mastery: 8, voice: true, sessionMinutes: 10 };

export function newLevelProgress(): LevelProgress {
  return { recent: [], answered: 0, wrongStreak: 0, helper: 0, warmupOffered: false };
}

export function newProgress(): Progress {
  return {
    version: 1,
    level: 0,
    current: 0,
    levels: {},
    skills: Object.fromEntries(SKILLS.map((s) => [s, { right: 0, wrong: 0, recent: [] }])) as unknown as Record<Skill, SkillStats>,
    missed: {},
    stars: 0,
    stickers: [],
    introSeen: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function levelProgress(p: Progress, id: number): LevelProgress {
  return p.levels[id] ?? newLevelProgress();
}

const KEY = 'aria-clock:v1:progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Progress;
      if (saved.version === 1) {
        const base = newProgress();
        return { ...base, ...saved, skills: { ...base.skills, ...saved.skills }, settings: { ...base.settings, ...saved.settings } };
      }
    }
  } catch {
    /* fall through to a fresh start */
  }
  return newProgress();
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked — keep playing */
  }
}
