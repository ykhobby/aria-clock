// Everything the app says. Each line is a sentence; the parts in [brackets]
// are numbers and times. Phrases are recorded clips in the Gemini voice, made
// once by scripts/voice.ts, and identical wording shares one clip. Numbers and
// times are put together from a small set of recorded number words ("seven" +
// "twenty-two"), with the device's own voice as a backup if a word is missing.

import { LEVELS } from '../learn/levels';
import { LIFE_AMPM, LIFE_SET } from '../learn/life';
import { numberWord, timeToSpeech } from '../time/words';

export interface Line {
  id: string;
  /** Spoken text, with [device-voice parts] in brackets. */
  text: string;
}

export interface Segment {
  text: string;
  /** A number or time: said word by word from number clips, or by the device voice. */
  device: boolean;
  /** Clip id for recorded phrases. */
  clip?: string;
  /** For numbers and times: the number clips that say it, in order. */
  words?: { text: string; clip: string }[];
}

const line = (id: string, text: string): Line => ({ id, text });
const w = numberWord;
const t = (h: number, m: number) => `[${timeToSpeech(h, m)}]`;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);

export const V = {
  // ---- times
  /** Just the time, e.g. for the 🔈 buttons. */
  time: (h: number, m: number) => line(`time-${h}-${m}`, t(h, m)),
  itsTime: (h: number, m: number) => line(`its-${h}-${m}`, `It's ${t(h, m)}.`),
  thisIsTime: (h: number, m: number) => line(`this-is-${h}-${m}`, `This is ${t(h, m)}.`),
  willBeTime: (h: number, m: number) => line(`will-be-${h}-${m}`, `It will be ${t(h, m)}.`),
  timeNow: (h: number, m: number, part: 'morning' | 'afternoon' | 'evening' | 'night') =>
    line(`now-${h}-${m}-${part}`, `It's ${t(h, m)}, ${part === 'night' ? 'at night' : `in the ${part}`}.`),

  // ---- question prompts
  whatTime: line('q-what-time', 'What time is it?'),
  showMe: (h: number, m: number) => line(`q-show-${h}-${m}`, `Show me ${t(h, m)}.`),
  makeShort: (h: number, m: number) => line(`q-make-${h}-${m}`, `Move the short hand to make ${t(h, m)}.`),
  detective: line('q-detective', 'Which number has the short hand just gone past?'),
  tapShort: line('q-tap-short', 'Tap the short hand.'),
  tapLong: line('q-tap-long', 'Tap the long hand.'),
  findNumber: (n: number) => line(`q-find-${n}`, `Find number [${w(n)}].`),
  typeTime: line('q-type', 'What time is it? Type it in!'),
  matchPrompt: line('q-match', 'Match each time to its numbers!'),
  count5: line('q-count5', 'How many minutes? Count by fives!'),
  plus: (mins: number) => line(`q-plus-${mins}`, mins === 60 ? 'What time will it be in [one hour]?' : 'What time will it be in half an hour?'),
  lifeSet: (id: string) => line(`life-set-${id}`, LIFE_SET.find((x) => x.id === id)!.text),
  lifeAmpm: (id: string) => line(`life-ampm-${id}`, LIFE_AMPM.find((x) => x.id === id)!.text),
  morning: line('ans-morning', 'Morning.'),
  afternoon: line('ans-afternoon', 'Afternoon.'),
  minutes: (m: number) => line(`ans-minutes-${m}`, `[${w(m)} minutes].`),

  // ---- praise and gentle starts
  praise: [
    line('praise-0', 'Great job, Aria!'),
    line('praise-1', 'You got it!'),
    line('praise-2', 'Super!'),
    line('praise-3', 'Brilliant!'),
    line('praise-4', 'Yes! Well done, Aria!'),
    line('praise-5', 'Amazing!'),
    line('praise-6', 'Woohoo!'),
  ],
  gentle: [line('gentle-0', 'Good try!'), line('gentle-1', 'Ooh, nearly!'), line('gentle-2', 'Nice try!'), line('gentle-3', "Let's look together.")],

  // ---- explanations: the short hand
  shortTellsHour: line('ex-short-tells-hour', 'The short hand tells the hour.'),
  shortPointsTo: (n: number) => line(`ex-short-points-${n}`, `The short hand points to [${w(n)}].`),
  shortJustPast: (n: number) => line(`ex-short-past-${n}`, `The short hand has just gone past [${w(n)}].`),
  shortNotReached: (n: number) => line(`ex-short-not-reached-${n}`, `It hasn't quite reached [${w(n)}].`),
  shortNearly: (n: number) => line(`ex-short-nearly-${n}`, `The short hand is nearly at [${w(n)}]. So we say "to" [${w(n)}].`),
  toUsesNext: line('ex-to-uses-next', 'For "to" times, we use the next hour.'),
  hourIs: (n: number) => line(`ex-hour-is-${n}`, `So the hour is [${w(n)}].`),
  shortGoesOn: (n: number) => line(`ex-short-goes-on-${n}`, `The short hand goes on [${w(n)}].`),
  shortGoesPast: (n: number) => line(`ex-short-goes-past-${n}`, `The short hand goes just past [${w(n)}].`),

  // ---- explanations: the long hand
  longOn12: line('ex-long-12', "The long hand is on [twelve]. So it's o'clock."),
  longOn6: line('ex-long-6', "The long hand is on [six]. So it's half past."),
  longOn3: line('ex-long-3', "The long hand is on [three]. That's quarter past."),
  longOn9: line('ex-long-9', "The long hand is on [nine]. That's quarter to."),
  longCount: (n: number) => line(`ex-long-count-${n}`, `The long hand is on [${w(n)}]. Count by fives. That makes [${w(n * 5)} minutes].`),
  countMarks: line('ex-count-marks', 'Find the last number the long hand passed, then count on, mark by mark.'),
  longGoes12: line('ex-long-goes-12', 'The long hand goes up on [twelve].'),
  longGoes6: line('ex-long-goes-6', 'The long hand goes down on [six].'),
  longGoesOn: (n: number) => line(`ex-long-goes-on-${n}`, `The long hand goes on [${w(n)}].`),

  // ---- explanations: real life and matching
  plusHint: (mins: number) =>
    line(
      `ex-plus-${mins}`,
      mins === 60
        ? 'In [one hour], the long hand goes all the way round, and the short hand moves on to the next number.'
        : 'In half an hour, the long hand goes half way round.',
    ),
  morningHint: line('ex-morning', "Morning is from when we wake up until lunchtime, at [twelve o'clock]."),
  afternoonHint: line('ex-afternoon', "Afternoon starts at [twelve o'clock], after the morning."),
  matchHint: line('ex-match', "Each time in words has its own numbers. Let's look again."),

  // ---- explanations: meeting the clock
  thisShort: line('ex-this-short', 'This is the short hand. It tells the hour.'),
  thisLong: line('ex-this-long', 'This is the long hand. It tells the minutes.'),
  hereNumber: (n: number) => line(`ex-here-number-${n}`, `Here is number [${w(n)}]!`),

  // ---- moments
  helpersOn: line('ev-helpers-on', "I've turned on some helpers for you."),
  tryAgain: line('ev-try-again', 'Now you have another go, Aria!'),
  fixedIt: line('praise-fixed', 'You fixed it! Well done.'),
  warmupOffer: line('ev-warmup-offer', "You're working so hard, Aria! Shall we do a quick warm-up with some easier ones?"),
  warmupDone: line('ev-warmup-done', "Great warm-up! Let's keep going."),
  sessionDone: line('ev-session-done', 'Wow, Aria, great clock work today! You can have a rest now, or keep playing.'),
  levelUp: (id: number) => line(`ev-levelup-${id}`, `Hooray, Aria! You finished another level! You won ${LEVELS[id].sticker.name}!`),
  intro: (level: number, step: number) => line(`intro-${level}-${step}`, LEVELS[level].intro[step].say),
};

// ---- splitting sentences into clip and device-voice parts ----------------

/** Text with the [brackets] removed, for showing on screen. */
export function plain(text: string): string {
  return text.replace(/\[|\]/g, '');
}

/** Stable clip id for a recorded phrase: identical wording shares a clip. */
export function clipId(text: string): string {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${slug}-${h.toString(36)}`;
}

// ---- number words --------------------------------------------------------

/** The words every number and time is made of. "to" and "oh" are recorded with
 *  the number after them, so they're never a lone word that sounds like "two" or "O". */
export const NUMBER_VOCAB: string[] = [
  ...Array.from({ length: 59 }, (_, i) => w(i + 1)),
  ...HOURS.map((n) => `to ${w(n)}`),
  ...Array.from({ length: 9 }, (_, i) => `oh ${w(i + 1)}`),
  "o'clock",
  'past',
  'half past',
  'quarter past',
  'quarter to',
  'hour',
  'minute',
  'minutes',
];
const VOCAB = new Set(NUMBER_VOCAB);
export const numberClipId = (word: string) => `num-${clipId(word)}`;

/** Split a number or time into vocabulary words, longest match first. Null if
 *  any part isn't in the vocabulary (then the device voice says it all). */
export function numberWords(text: string): string[] | null {
  const tokens = text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    const two = `${tokens[i]} ${tokens[i + 1]}`;
    if (i + 1 < tokens.length && VOCAB.has(two)) {
      out.push(two);
      i += 2;
    } else if (VOCAB.has(tokens[i])) out.push(tokens[i++]);
    else return null;
  }
  return out;
}

/** Split a line into recorded phrases and numbers. A phrase that
 *  runs on into a number is recorded with a trailing "…" so it sounds unfinished. */
export function segments(l: Line): Segment[] {
  const out: Segment[] = [];
  const parts = l.text.split(/(\[[^\]]*\])/).filter((p) => p !== '');
  parts.forEach((p, i) => {
    if (p.startsWith('[')) {
      const text = p.slice(1, -1);
      const words = numberWords(text)?.map((t) => ({ text: t, clip: numberClipId(t) }));
      out.push({ text, device: true, words });
      return;
    }
    // Punctuation left over after a number (the "." in "…[ten].") has nothing to record.
    let text = p.replace(/^[\s,.;:!?]+/, '').trim();
    if (!/[a-z]/i.test(text)) return;
    const next = parts[i + 1];
    if (next?.startsWith('[') && !/[.!?…]$/.test(text)) text += '…';
    out.push({ text, device: false, clip: clipId(text) });
  });
  return out;
}

/** Every line the app can say (used by the tests and the recording script). */
export function allLines(): Line[] {
  const out: Line[] = [];
  const add = (...ls: Line[]) => out.push(...ls);
  for (const h of HOURS)
    for (let m = 0; m < 60; m++) add(V.time(h, m), V.itsTime(h, m), V.thisIsTime(h, m), V.willBeTime(h, m), V.showMe(h, m), V.makeShort(h, m));
  for (const part of ['morning', 'afternoon', 'evening', 'night'] as const) add(V.timeNow(3, 0, part));
  add(V.whatTime, V.detective, V.tapShort, V.tapLong, ...HOURS.map(V.findNumber));
  add(V.typeTime, V.matchPrompt, V.count5, V.plus(60), V.plus(30), V.morning, V.afternoon);
  add(...LIFE_SET.map((x) => V.lifeSet(x.id)), ...LIFE_AMPM.map((x) => V.lifeAmpm(x.id)));
  for (let m = 5; m < 60; m += 5) add(V.minutes(m));
  add(...V.praise, ...V.gentle);
  add(V.shortTellsHour, V.toUsesNext);
  for (const n of HOURS) add(V.shortPointsTo(n), V.shortJustPast(n), V.shortNotReached(n), V.shortNearly(n), V.hourIs(n), V.shortGoesOn(n), V.shortGoesPast(n));
  add(V.longOn12, V.longOn6, V.longOn3, V.longOn9, V.countMarks, V.longGoes12, V.longGoes6);
  for (let n = 1; n <= 11; n++) add(V.longCount(n), V.longGoesOn(n));
  add(V.plusHint(60), V.plusHint(30), V.morningHint, V.afternoonHint, V.matchHint);
  add(V.thisShort, V.thisLong, ...HOURS.map(V.hereNumber));
  add(V.helpersOn, V.tryAgain, V.fixedIt, V.warmupOffer, V.warmupDone, V.sessionDone);
  for (const l of LEVELS) {
    add(V.levelUp(l.id));
    l.intro.forEach((_, i) => add(V.intro(l.id, i)));
  }
  return out;
}

/** The distinct phrases to record in the Gemini voice. */
export function recordables(): Line[] {
  const seen = new Map<string, Line>();
  for (const l of allLines()) for (const s of segments(l)) if (!s.device && !seen.has(s.clip!)) seen.set(s.clip!, { id: s.clip!, text: s.text });
  return [...seen.values()];
}

/** The number words to record. */
export function numberClips(): Line[] {
  return NUMBER_VOCAB.map((t) => ({ id: numberClipId(t), text: t }));
}

/** Plain text of a sequence of lines (for timing and display). */
export function linesText(lines: Line[]): string {
  return lines.map((l) => plain(l.text)).join(' ');
}
