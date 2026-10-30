import { describe, expect, it } from 'vitest';
import { timeToDigital, timeToSpeech, timeToWords } from './words';

describe('timeToWords (Australian phrasing; odd minutes said digitally)', () => {
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
    [3, 7, '3 oh 7'],
    [3, 1, '3 oh 1'],
    [3, 59, '3 fifty-nine'],
    [3, 38, '3 thirty-eight'],
    [6, 31, '6 thirty-one'],
    [6, 22, '6 twenty-two'],
  ])('%i:%i → %s', (h, m, w) => expect(timeToWords(h, m)).toBe(w));

  it('speech form spells numbers', () => {
    expect(timeToSpeech(3, 40)).toBe('twenty to four');
    expect(timeToSpeech(11, 0)).toBe("eleven o'clock");
    expect(timeToSpeech(6, 31)).toBe('six thirty-one');
    expect(timeToSpeech(6, 7)).toBe('six oh seven');
    expect(timeToSpeech(12, 58)).toBe('twelve fifty-eight');
  });

  it('digital form pads minutes', () => {
    expect(timeToDigital(3, 5)).toBe('3:05');
    expect(timeToDigital(12, 30)).toBe('12:30');
  });
});
