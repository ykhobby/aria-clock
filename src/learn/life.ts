// Real-life moments for level 15, about Aria's own day.

export interface LifeSet {
  id: string;
  icon: string;
  h: number;
  m: number;
  /** Spoken and shown. */
  text: string;
}

export interface LifeAmpm {
  id: string;
  icon: string;
  h: number;
  m: number;
  ampm: 'morning' | 'afternoon';
  text: string;
}

export const LIFE_SET: LifeSet[] = [
  { id: 'bedtime', icon: '🛏️', h: 7, m: 30, text: 'Bedtime is [half past seven]. Show me bedtime!' },
  { id: 'school', icon: '🏫', h: 9, m: 0, text: "School starts at [nine o'clock]. Show me!" },
  { id: 'lunch', icon: '🥪', h: 12, m: 30, text: 'Lunch is at [half past twelve]. Show me lunchtime!' },
  { id: 'dinner', icon: '🍝', h: 6, m: 0, text: "Dinner is at [six o'clock]. Show me dinnertime!" },
  { id: 'swimming', icon: '🏊', h: 4, m: 15, text: 'Swimming is at [quarter past four]. Show me!' },
  { id: 'park', icon: '🛝', h: 10, m: 45, text: "We're going to the park at [quarter to eleven]. Show me!" },
  { id: 'story', icon: '📖', h: 7, m: 15, text: 'Story time is at [quarter past seven]. Show me!' },
  { id: 'wakeup', icon: '⏰', h: 6, m: 45, text: 'Aria wakes up at [quarter to seven]. Show me!' },
  { id: 'cartoons', icon: '📺', h: 5, m: 20, text: 'Cartoons start at [twenty past five]. Show me!' },
  { id: 'party', icon: '🎉', h: 2, m: 40, text: 'The party starts at [twenty to three]. Show me!' },
];

export const LIFE_AMPM: LifeAmpm[] = [
  { id: 'breakfast', icon: '🥣', h: 7, m: 0, ampm: 'morning', text: "Aria eats breakfast at [seven o'clock]. Is that in the morning or the afternoon?" },
  { id: 'dressed', icon: '👗', h: 7, m: 30, ampm: 'morning', text: 'Aria gets dressed at [half past seven]. Morning or afternoon?' },
  { id: 'school', icon: '🏫', h: 9, m: 0, ampm: 'morning', text: "School starts at [nine o'clock]. Morning or afternoon?" },
  { id: 'recess', icon: '🍎', h: 10, m: 30, ampm: 'morning', text: 'Recess is at [half past ten]. Morning or afternoon?' },
  { id: 'lunch', icon: '🥪', h: 12, m: 30, ampm: 'afternoon', text: 'Lunch is at [half past twelve]. Morning or afternoon?' },
  { id: 'hometime', icon: '🎒', h: 3, m: 0, ampm: 'afternoon', text: "School finishes at [three o'clock]. Morning or afternoon?" },
  { id: 'playground', icon: '🛝', h: 4, m: 0, ampm: 'afternoon', text: "Aria plays at the playground at [four o'clock], after school. Morning or afternoon?" },
  { id: 'swimming', icon: '🏊', h: 4, m: 30, ampm: 'afternoon', text: 'Swimming lessons are at [half past four], after school. Morning or afternoon?' },
];
