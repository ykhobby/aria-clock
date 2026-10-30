import { describe, expect, it } from 'vitest';
import { alignTranscript, cutAtLongPauses, cutToFit, expectedSeconds, parseNumbered, parseSilences, piecesFit, sameWords, splitAtLongestGaps } from './split';

describe('batch splitting', () => {
  it('parses ffmpeg silencedetect output', () => {
    const out = `[silencedetect @ 0x1] silence_start: 1.2
[silencedetect @ 0x1] silence_end: 2.4 | silence_duration: 1.2
[silencedetect @ 0x1] silence_start: 3.9
[silencedetect @ 0x1] silence_end: 4.1 | silence_duration: 0.2`;
    expect(parseSilences(out)).toEqual([
      { start: 1.2, end: 2.4 },
      { start: 3.9, end: 4.1 },
    ]);
  });

  it('cuts at the longest pauses, ignoring short ones inside a sentence', () => {
    const gaps = [
      { start: 1.0, end: 2.2 }, // between lines
      { start: 3.0, end: 3.3 }, // comma pause inside line 2
      { start: 4.5, end: 5.6 }, // between lines
    ];
    expect(splitAtLongestGaps(gaps, 3, 7)).toEqual([
      { start: 0, end: 1.0 },
      { start: 2.2, end: 4.5 },
      { start: 5.6, end: 7 },
    ]);
  });

  it('returns null when there are too few pauses (a line was merged or skipped)', () => {
    expect(splitAtLongestGaps([{ start: 1, end: 2 }], 3, 5)).toBeNull();
  });

  it('ignores lead-in and trailing silence', () => {
    const gaps = [
      { start: 0, end: 0.3 },
      { start: 1.5, end: 2.5 },
      { start: 4.0, end: 4.5 },
    ];
    expect(splitAtLongestGaps(gaps, 2, 4.5)).toEqual([
      { start: 0, end: 1.5 },
      { start: 2.5, end: 4.5 },
    ]);
  });

  it('flags pieces whose length does not match their text', () => {
    const texts = ["one o'clock", 'Watch the long hand go half way round, down to six.'];
    const good = [
      { start: 0, end: 1.1 },
      { start: 2, end: 6.0 },
    ];
    const swapped = [
      { start: 0, end: 4.0 },
      { start: 5, end: 6.1 },
    ];
    expect(piecesFit(good, texts)).toBe(true);
    expect(piecesFit(swapped, texts)).toBe(false);
    expect(expectedSeconds('two minutes past one')).toBeGreaterThan(1.3);
  });

  it('compares a transcript with the script, ignoring digits and punctuation', () => {
    expect(sameWords('1/4 past 1.', 'quarter past one')).toBe(true);
    expect(sameWords('21 minutes past 1.', 'twenty-one minutes past one')).toBe(true);
    expect(sameWords("It's half past 3!", "It's half past three.")).toBe(true);
    expect(sameWords('20 past 3', 'twenty to three')).toBe(false);
    expect(sameWords(undefined, 'one')).toBe(false);
  });

  it('matches transcript lines to the script, skipping extra phrases and missing lines', () => {
    const script = ['four minutes past four', 'five past four', 'six minutes past four', 'seven minutes past four'];
    const heard = ['4 minutes past 4', "4 o'clock", '5 past 4', '7 minutes past 4'];
    // the stray "4 o'clock" is skipped; "six minutes past four" was never said
    expect(alignTranscript(heard, script)).toEqual([
      [0, 0],
      [2, 1],
      [3, 3],
    ]);
  });

  it('keeps a stray extra phrase as its own piece instead of shifting later cuts', () => {
    // 3 lines plus one stray phrase: four long pauses would be needed for 5 pieces
    const gaps = [
      { start: 1.0, end: 2.1 },
      { start: 3.0, end: 3.25 }, // comma pause, too short to cut
      { start: 4.0, end: 5.0 },
      { start: 5.6, end: 6.5 }, // after the stray phrase
    ];
    const pieces = cutAtLongPauses(gaps, 3, 8)!;
    expect(pieces).toHaveLength(4);
    expect(pieces[2]).toEqual({ start: 5.0, end: 5.6 }); // the stray
  });

  it('parses numbered transcript lines by number', () => {
    expect(parseNumbered('1. One o\'clock.\n3) Half past two\nnoise', 3)).toEqual(["One o'clock.", '', 'Half past two']);
  });

  it('cuts to fit line lengths when every pause is the same length', () => {
    // "Hi." (short) · "This is a much longer line, with a comma." · "Bye."
    const gaps = [
      { start: 0.8, end: 1.3 },
      { start: 2.5, end: 3.0 }, // the comma inside line 2
      { start: 4.6, end: 5.1 },
    ];
    const pieces = cutToFit(gaps, ['Hi.', 'This is a much longer line, with a comma.', 'Bye.'], 6)!;
    expect(pieces).toEqual([
      { start: 0, end: 0.8 },
      { start: 1.3, end: 4.6 },
      { start: 5.1, end: 6 },
    ]);
  });
});
