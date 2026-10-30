// Answer boards for the later question kinds: matching pairs and the number pad.

import { useMemo, useState } from 'react';
import type { TimeOption } from '../learn/distractors';
import { speak } from '../speech';
import { timeToDigital, timeToWords } from '../time/words';
import { V } from '../voice/lines';
import { Words } from './TimeLabel';

/** Pair each time in words with its digital time. Reports the first wrong pairing, if any. */
export function MatchBoard({ pairs, onDone }: { pairs: TimeOption[]; onDone: (firstWrong: TimeOption | null) => void }) {
  const digitalOrder = useMemo(() => {
    // Shuffle so the digital column isn't in the same order as the words.
    const idx = pairs.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (idx.every((v, i) => v === i)) idx.push(idx.shift()!);
    return idx;
  }, [pairs]);
  const [picked, setPicked] = useState<{ side: 'w' | 'd'; i: number } | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [wobble, setWobble] = useState<number | null>(null);
  const [firstWrong, setFirstWrong] = useState<TimeOption | null>(null);

  const tap = (side: 'w' | 'd', i: number) => {
    if (done.has(i)) return;
    if (!picked || picked.side === side) {
      setPicked({ side, i });
      if (side === 'w') speak(V.time(pairs[i].h, pairs[i].m));
      return;
    }
    const [w, d] = side === 'w' ? [i, picked.i] : [picked.i, i];
    setPicked(null);
    if (w === d) {
      const next = new Set(done).add(w);
      setDone(next);
      if (next.size === pairs.length) onDone(firstWrong);
    } else {
      if (!firstWrong) setFirstWrong(pairs[w]);
      setWobble(w);
      setTimeout(() => setWobble(null), 500);
    }
  };

  const cls = (side: 'w' | 'd', i: number) =>
    ['card', done.has(i) && 'card--done', picked?.side === side && picked.i === i && 'card--picked', side === 'w' && wobble === i && 'card--wobble']
      .filter(Boolean)
      .join(' ');

  return (
    <div className="match">
      <div className="match__col">
        {pairs.map((p, i) => (
          <button key={i} className={cls('w', i)} onClick={() => tap('w', i)} aria-label={timeToWords(p.h, p.m)}>
            <Words text={timeToWords(p.h, p.m)} />
          </button>
        ))}
      </div>
      <div className="match__col">
        {digitalOrder.map((i) => (
          <button key={i} className={`${cls('d', i)} card--digital`} onClick={() => tap('d', i)}>
            {timeToDigital(pairs[i].h, pairs[i].m)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Big number pad for typing a digital time: hour box, then minutes box. */
export function NumberPad({ onSubmit, disabled }: { onSubmit: (t: { h: number; m: number }) => void; disabled?: boolean }) {
  const [hour, setHour] = useState('');
  const [min, setMin] = useState('');
  const [box, setBox] = useState<'h' | 'm'>('h');

  const digit = (d: number) => {
    if (disabled) return;
    if (box === 'h') {
      if (hour === '') {
        if (d === 0) return;
        setHour(String(d));
        if (d >= 2) setBox('m');
      } else if (hour === '1' && d <= 2) {
        setHour(`1${d}`);
        setBox('m');
      } else {
        // "1" then 3–9: the hour was 1, and this digit starts the minutes.
        setBox('m');
        if (d <= 5) setMin(String(d));
      }
      return;
    }
    if (min.length >= 2) return;
    if (min === '' && d > 5) return; // minutes start with 0–5
    setMin(min + d);
  };

  const back = () => {
    if (disabled) return;
    if (box === 'm' && min) setMin(min.slice(0, -1));
    else {
      setBox('h');
      setHour(hour.slice(0, -1));
    }
  };

  const ready = hour !== '' && min.length === 2;
  return (
    <div className="pad">
      <div className="pad__display" aria-live="polite">
        <button className={`pad__box ${box === 'h' ? 'pad__box--on' : ''}`} onClick={() => setBox('h')} aria-label="Hours">
          {hour || '_'}
        </button>
        <span className="pad__colon">:</span>
        <button className={`pad__box pad__box--wide ${box === 'm' ? 'pad__box--on' : ''}`} onClick={() => hour && setBox('m')} aria-label="Minutes">
          {(min + '__').slice(0, 2)}
        </button>
      </div>
      <div className="pad__keys">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => digit(d)}>
            {d}
          </button>
        ))}
        <button onClick={back} aria-label="Delete">
          ⌫
        </button>
        <button onClick={() => digit(0)}>0</button>
        <button className="primary" disabled={!ready || disabled} onClick={() => onSubmit({ h: Number(hour), m: Number(min) })} aria-label="Done">
          ✔
        </button>
      </div>
    </div>
  );
}
