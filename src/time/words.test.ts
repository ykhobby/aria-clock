import { describe, expect, it } from 'vitest';
import { timeToDigital, timeToSpeech, timeToWords } from './words';

describe('timeToWords (Australian phrasing)', () => {
  it.each([
    [3, 0, "3 o'clock"],
    [3, 15, 'quarter past 3'],
    [3, 30, 'half past 3'],
    [3, 45, 'quarter to 4'],
    [12, 45, 'quarter to 1'],
    [3, 5, '5 past 3'],
    [3, 20, '20 past 3'],
    [3, 25, '25 past 3'],
    [3, 40, '20 to 4'],
    [3, 55, '5 to 4'],
    [3, 7, '7 minutes past 3'],
    [3, 1, '1 minute past 3'],
    [3, 59, '1 minute to 4'],
    [3, 38, '22 minutes to 4'],
  ])('%i:%i → %s', (h, m, w) => expect(timeToWords(h, m)).toBe(w));

  it('speech form spells numbers', () => {
    expect(timeToSpeech(3, 40)).toBe('twenty to four');
    expect(timeToSpeech(11, 0)).toBe("eleven o'clock");
  });

  it('digital form pads minutes', () => {
    expect(timeToDigital(3, 5)).toBe('3:05');
    expect(timeToDigital(12, 30)).toBe('12:30');
  });
});
