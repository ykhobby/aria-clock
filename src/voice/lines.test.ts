import { describe, expect, it } from 'vitest';
import { fromHM } from '../clock/geometry';
import { makeQuestion } from '../learn/engine';
import { explainAmpm, explainCount5, explainDetective, explainMatch, explainMeetHand, explainMeetNumber, explainPlus, explainRead, explainSet, explainType } from '../learn/explain';
import { LEVELS } from '../learn/levels';
import { newProgress } from '../store';
import { allLines, numberClips, numberWords, recordables, segments, V, type Line } from './lines';

const catalogue = new Map(allLines().map((l) => [l.id, l.text]));

function expectRecorded(lines: Line[]) {
  for (const l of lines) {
    expect(catalogue.has(l.id), `missing clip ${l.id}`).toBe(true);
    expect(catalogue.get(l.id)).toBe(l.text);
  }
}

describe('voice line catalogue', () => {
  it('recorded phrases never contain numbers (the device voice says those)', () => {
    const NUM = /\d|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\b/i;
    for (const r of recordables()) expect(r.text, r.text).not.toMatch(NUM);
    // and every time a sentence includes is spoken by the device voice
    for (const s of segments(V.itsTime(9, 55))) if (s.device) expect(s.text).toBe('five to ten');
  });

  it('says every number and time from recorded number words', () => {
    for (const l of allLines()) for (const s of segments(l)) if (s.device) expect(s.words, s.text).toBeTruthy();
    expect(numberWords('twenty to eight')).toEqual(['twenty', 'to eight']);
    expect(numberWords('quarter to eight')).toEqual(['quarter to', 'eight']);
    expect(numberWords('seven oh five')).toEqual(['seven', 'oh five']);
    expect(numberWords('Twenty-five minutes')).toEqual(['twenty-five', 'minutes']);
    expect(numberClips().length).toBeLessThan(100);
  });

  it('needs only a couple of hundred recordings', () => {
    expect(recordables().length).toBeLessThan(250);
  });

  it('has unique ids and no empty text', () => {
    const all = allLines();
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const l of all) {
      expect(l.text.trim()).not.toBe('');
      expect(l.text, l.id).not.toMatch(/undefined|NaN/);
    }
  });

  it('covers every time on the clock', () => {
    for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m++) expectRecorded([V.time(h, m)]);
  });

  it('covers every explanation the app can give', () => {
    const p = newProgress();
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (const l of LEVELS.filter((l) => l.playable)) {
      for (let i = 0; i < 300; i++) {
        const q = makeQuestion(l, p, rng);
        if (q.kind === 'read') for (const o of q.options!) if (o.h !== q.h || o.m !== q.m) expectRecorded(explainRead(q, o).say);
        if (q.kind === 'set') {
          for (let k = 0; k < 720; k += 37) expectRecorded(explainSet(q, k).say);
          expectRecorded(explainSet(q, fromHM(q.h, 0)).say);
        }
        if (q.kind === 'detective') expectRecorded(explainDetective(q).say);
        if (q.kind === 'count5') expectRecorded([...explainCount5(q).say, V.minutes(q.m)]);
        if (q.kind === 'type') for (let k = 0; k < 720; k += 29) expectRecorded(explainType(q, { h: Math.floor(k / 60) || 12, m: k % 60 }).say);
        if (q.kind === 'match') expectRecorded(explainMatch().say);
        if (q.kind === 'life-plus') expectRecorded([...explainPlus(q).say, V.plus(q.plus!)]);
        if (q.kind === 'life-ampm') expectRecorded([...explainAmpm(q).say, V.lifeAmpm(q.scenario!)]);
        if (q.kind === 'life-set') expectRecorded([V.lifeSet(q.scenario!), ...explainSet(q, q.start!).say]);
        if (q.kind === 'meet-hand') expectRecorded(explainMeetHand(q).say);
        if (q.kind === 'meet-number') expectRecorded(explainMeetNumber(q).say);
      }
    }
  });

  it('covers intros and level-ups', () => {
    for (const l of LEVELS) {
      expectRecorded([V.levelUp(l.id)]);
      l.intro.forEach((_, i) => expectRecorded([V.intro(l.id, i)]));
    }
  });
});
