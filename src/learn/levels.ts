// Level definitions. Each level is only a little harder than the last.

import type { ClockHelpers } from '../clock/ClockFace';
import type { HandName } from '../clock/drag';
import { fromHM } from '../clock/geometry';

export type QuestionKind =
  | 'meet-hand'
  | 'meet-number'
  | 'read'
  | 'set'
  | 'detective'
  | 'match' // pair word times with digital times
  | 'type' // type the digital time on a number pad
  | 'count5' // how many minutes is the long hand showing?
  | 'life-set' // "Bedtime is half past seven. Show me!"
  | 'life-plus' // "What time will it be in one hour?"
  | 'life-ampm'; // "Is that in the morning or the afternoon?"

export interface IntroStep {
  say: string;
  minutes?: number;
  highlight?: HandName | 'both' | null;
  highlightNumber?: number | null;
  helpers?: ClockHelpers;
}

export interface LevelDef {
  id: number;
  title: string;
  icon: string;
  sticker: { emoji: string; name: string };
  /** Question kinds, repeated to weight them. */
  kinds: QuestionKind[];
  /** Minutes used for this level's times. */
  minutes: number[];
  /** Minutes allowed in wrong answers (any minute when left out). */
  answerMinutes?: number[];
  options: number;
  /** Before level 3 answers say "o'clock" only, no digital. */
  wordsOnly?: boolean;
  /** Set questions: only the short hand moves (minute stays on 12). */
  hourOnly?: boolean;
  setSnap?: number;
  intro: IntroStep[];
  playable: boolean;
}

const T = fromHM;

export const LEVELS: LevelDef[] = [
  {
    id: 0,
    title: 'Meet the clock',
    icon: '👋',
    sticker: { emoji: '🦄', name: 'Sparkle the Unicorn' },
    kinds: ['meet-hand', 'meet-hand', 'meet-number', 'meet-number'],
    minutes: [0],
    answerMinutes: [0],
    options: 3,
    wordsOnly: true,
    playable: true,
    intro: [
      { say: 'Hi Aria! This is your watch.', minutes: T(10, 10) },
      { say: 'It has [two] hands.', minutes: T(4, 0), highlight: 'both' },
      { say: 'The short hand tells us the hour.', highlight: 'hour' },
      { say: 'The long hand tells us the minutes.', highlight: 'minute' },
      { say: 'And all around are the numbers, [one to twelve].', highlightNumber: 12 },
      { say: "Let's play!" },
    ],
  },
  {
    id: 1,
    title: "O'clock",
    icon: '🕒',
    sticker: { emoji: '🧚', name: 'Pip the Fairy' },
    kinds: ['read'],
    minutes: [0],
    answerMinutes: [0],
    options: 3,
    wordsOnly: true,
    playable: true,
    intro: [
      { say: 'When the long hand points straight up to [twelve]…', minutes: T(3, 0), highlight: 'minute' },
      { say: "…it's something o'clock!", highlight: 'minute' },
      { say: 'The short hand shows which hour. Here it points to [three].', highlight: 'hour', highlightNumber: 3 },
      { say: "So it's [three o'clock]!", highlight: 'both' },
      { say: "Now the short hand points to [seven]. It's [seven o'clock]!", minutes: T(7, 0), highlight: 'hour', highlightNumber: 7 },
    ],
  },
  {
    id: 2,
    title: "Make o'clock",
    icon: '👆',
    sticker: { emoji: '🌈', name: 'Rainbow Bridge' },
    kinds: ['set'],
    minutes: [0],
    answerMinutes: [0],
    options: 3,
    wordsOnly: true,
    hourOnly: true,
    playable: true,
    intro: [
      { say: 'Now you can move the short hand!', minutes: T(2, 0), highlight: 'hour' },
      { say: 'The long hand stays up on [twelve].', highlight: 'minute' },
      { say: "To make [five o'clock], turn the short hand to [five].", minutes: T(5, 0), highlight: 'hour', highlightNumber: 5 },
      { say: "Then press the tick. Let's try!" },
    ],
  },
  {
    id: 3,
    title: 'Half past',
    icon: '🌗',
    sticker: { emoji: '🐉', name: 'Ember the Dragon' },
    kinds: ['read'],
    minutes: [30],
    answerMinutes: [0, 30],
    options: 3,
    playable: true,
    intro: [
      { say: "Here's [three o'clock].", minutes: T(3, 0) },
      { say: 'Watch the long hand go half way round, down to [six].', minutes: T(3, 30), highlight: 'minute' },
      { say: 'Did you see the short hand move too? It is half way between [three] and [four].', highlight: 'hour', helpers: { hourSector: 1 } },
      { say: "It has just gone past [three], so we say [half past three]. We write it [three thirty].", highlight: 'hour', helpers: { hourSector: 1 } },
    ],
  },
  {
    id: 4,
    title: 'Hour hand detective',
    icon: '🔍',
    sticker: { emoji: '🧜‍♀️', name: 'Marina the Mermaid' },
    kinds: ['detective'],
    minutes: [30, 30, 30, 10, 20, 40, 50],
    answerMinutes: [0, 30],
    options: 3,
    playable: true,
    intro: [
      { say: "Time to be an hour hand detective!", minutes: T(3, 30) },
      { say: 'Look at the short hand.', highlight: 'hour' },
      { say: "It's close to [four], but it hasn't got there yet.", highlight: 'hour', highlightNumber: 4, helpers: { hourSector: 1 } },
      { say: 'The last number it went past is [three]. So the hour is [three]!', highlight: 'hour', highlightNumber: 3, helpers: { hourSector: 1 } },
    ],
  },
  {
    id: 5,
    title: 'Make half past',
    icon: '✋',
    sticker: { emoji: '🦋', name: 'Flutter the Butterfly' },
    kinds: ['set'],
    minutes: [30],
    answerMinutes: [0, 30],
    options: 3,
    setSnap: 30,
    playable: true,
    intro: [
      { say: "Your turn to make half past! Here's [two o'clock].", minutes: T(2, 0) },
      { say: 'Turn the long hand round to [six].', minutes: T(2, 30), highlight: 'minute' },
      { say: 'See how the short hand moves along too? Now it is [half past two].', highlight: 'hour', helpers: { hourSector: 1 } },
    ],
  },
  {
    id: 6,
    title: 'Mix it up',
    icon: '🎲',
    sticker: { emoji: '🏰', name: 'Cloud Castle' },
    kinds: ['read', 'read', 'set'],
    minutes: [0, 30],
    answerMinutes: [0, 30],
    options: 4,
    setSnap: 30,
    playable: true,
    intro: [
      { say: "O'clock and half past, all mixed up!", minutes: T(6, 0) },
      { say: "Long hand on [twelve]? O'clock.", highlight: 'minute' },
      { say: 'Long hand on [six]? Half past.', minutes: T(6, 30), highlight: 'minute' },
      { say: 'You can do it, Aria!' },
    ],
  },
  {
    id: 7,
    title: 'Quarter past',
    icon: '🍰',
    sticker: { emoji: '🐴', name: 'Clover the Pony' },
    kinds: ['read', 'read', 'read', 'set'],
    minutes: [15],
    options: 4,
    setSnap: 15,
    playable: true,
    intro: [
      { say: "Here's [three o'clock].", minutes: T(3, 0) },
      { say: 'Now the long hand goes a quarter of the way round, to [three].', minutes: T(3, 15), highlight: 'minute' },
      { say: "That's [fifteen minutes]. We say [quarter past three], and we write [three fifteen].", highlight: 'minute' },
      { say: 'See the short hand? It has only just left [three].', highlight: 'hour', helpers: { hourSector: 1 } },
    ],
  },
  {
    id: 8,
    title: 'Quarter to',
    icon: '⏳',
    sticker: { emoji: '👑', name: 'Princess Crown' },
    kinds: ['read', 'read', 'read', 'set'],
    minutes: [45],
    options: 4,
    setSnap: 15,
    playable: true,
    intro: [
      { say: "Here's [half past three].", minutes: T(3, 30) },
      { say: 'Watch the long hand go on, round to [nine].', minutes: T(3, 45), highlight: 'minute' },
      { say: "There's only a quarter left to get back to the top, so we say quarter to.", highlight: 'minute' },
      { say: 'Quarter to what? Look where the short hand is going. It is nearly at [four]!', highlight: 'hour', highlightNumber: 4, helpers: { hourSector: 1 } },
      { say: 'So it is [quarter to four]. Quarter to uses the next hour! We write it [three forty-five].', highlight: 'both' },
    ],
  },
  {
    id: 9,
    title: 'All the quarters',
    icon: '🎡',
    sticker: { emoji: '🪄', name: 'Magic Wand' },
    kinds: ['read', 'read', 'set', 'match'],
    minutes: [0, 15, 30, 45],
    options: 4,
    setSnap: 15,
    playable: true,
    intro: [
      { say: "Long hand on [twelve]: o'clock.", minutes: T(4, 0), highlight: 'minute' },
      { say: 'Long hand on [three]: quarter past.', minutes: T(4, 15), highlight: 'minute' },
      { say: 'Long hand on [six]: half past.', minutes: T(4, 30), highlight: 'minute' },
      { say: 'Long hand on [nine]: quarter to. And quarter to uses the next hour!', minutes: T(4, 45), highlight: 'minute', highlightNumber: 5 },
    ],
  },
  {
    id: 10,
    title: 'Count by 5s',
    icon: '🖐️',
    sticker: { emoji: '🌙', name: 'Luna the Moon' },
    kinds: ['count5', 'count5', 'count5', 'read'],
    minutes: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    options: 4,
    playable: true,
    intro: [
      { say: 'For the long hand, every number is worth [five minutes].', minutes: T(2, 0), helpers: { fives: 1 } },
      { say: 'Long hand on [one]: [five minutes].', minutes: T(2, 5), highlight: 'minute', helpers: { fives: 1 } },
      { say: 'On [two]: [ten minutes]. On [three]: [fifteen].', minutes: T(2, 15), highlight: 'minute', helpers: { fives: 1 } },
      { say: "Let's count by fives: [five], [ten], [fifteen], [twenty], [twenty-five], [thirty]!", minutes: T(2, 30), highlight: 'minute', helpers: { fives: 1 } },
      { say: 'Your watch has little pink fives around the edge to help you.', helpers: { fives: 1 } },
    ],
  },
  {
    id: 11,
    title: '5 minutes past',
    icon: '➡️',
    sticker: { emoji: '🦢', name: 'Grace the Swan' },
    kinds: ['read', 'read', 'set', 'match'],
    minutes: [5, 10, 20, 25],
    options: 4,
    setSnap: 5,
    playable: true,
    intro: [
      { say: "When the long hand is on this side, it is past the hour.", minutes: T(3, 10), highlight: 'minute', helpers: { fives: 1 } },
      { say: 'Long hand on [two] is [ten minutes], so it is [ten past three]. We write [three ten].', highlight: 'minute', helpers: { fives: 1 } },
      { say: 'Long hand on [five]? [Twenty-five past three]!', minutes: T(3, 25), highlight: 'minute', helpers: { fives: 1 } },
    ],
  },
  {
    id: 12,
    title: '5 minutes to',
    icon: '⬅️',
    sticker: { emoji: '🍭', name: 'Lolly Land' },
    kinds: ['read', 'read', 'set', 'match'],
    minutes: [35, 40, 50, 55],
    options: 4,
    setSnap: 5,
    playable: true,
    intro: [
      { say: 'When the long hand is on this side, we count how many minutes to the next hour.', minutes: T(3, 40), highlight: 'minute', helpers: { fives: 1 } },
      { say: 'Long hand on [eight]. Count back to the top: [five], [ten], [fifteen], [twenty]. [Twenty to four]!', highlight: 'minute', helpers: { fives: 1 } },
      { say: 'We write it [three forty]. And remember, "to" times use the next hour.', highlight: 'hour', helpers: { hourSector: 1 } },
    ],
  },
  {
    id: 13,
    title: 'Any 5 minutes',
    icon: '🌟',
    sticker: { emoji: '🎠', name: 'Carousel' },
    kinds: ['read', 'read', 'set', 'match', 'type'],
    minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    options: 4,
    setSnap: 5,
    playable: true,
    intro: [
      { say: 'Now any [five minutes], Aria!', minutes: T(6, 20), helpers: { fives: 1 } },
      { say: 'Past on this side…', highlight: 'minute', helpers: { fives: 1 } },
      { say: '…and to on the other side.', minutes: T(6, 40), highlight: 'minute', helpers: { fives: 1 } },
      { say: 'Sometimes you can type the time on the number pad too!' },
    ],
  },
  {
    id: 14,
    title: 'To the minute',
    icon: '🔬',
    sticker: { emoji: '🐲', name: 'Jade the Dragon' },
    kinds: ['read', 'read', 'type', 'set'],
    minutes: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 34, 36, 37, 38, 39, 41, 42, 43, 44, 46, 47, 48, 49, 51, 52, 53, 54, 56, 57, 58, 59],
    options: 4,
    setSnap: 1,
    playable: true,
    intro: [
      { say: 'Now for the tiny marks!', minutes: T(3, 20), helpers: { fives: 1 } },
      { say: 'Each little mark is [one minute].', minutes: T(3, 21), highlight: 'minute' },
      { say: 'Find the last [five], then count on. [Twenty]… [twenty-one], [twenty-two].', minutes: T(3, 22), highlight: 'minute', helpers: { fives: 1 } },
      { say: '[Twenty-two minutes past three]. We write it [three twenty-two].', highlight: 'both' },
    ],
  },
  {
    id: 15,
    title: 'Real life',
    icon: '🏡',
    sticker: { emoji: '💎', name: 'Rainbow Gem' },
    kinds: ['life-set', 'life-plus', 'life-ampm', 'read', 'type'],
    minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    options: 4,
    setSnap: 5,
    playable: true,
    intro: [
      { say: 'Clocks help us every day, Aria!', minutes: T(7, 30) },
      { say: 'They tell us when it is bedtime, or when school starts.', minutes: T(9, 0) },
      { say: "Let's use your watch in real life!" },
    ],
  },
];


export function isPlayable(id: number): boolean {
  return !!LEVELS[id]?.playable;
}
