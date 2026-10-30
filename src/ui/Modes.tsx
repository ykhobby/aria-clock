// Free play, real time and the sticker book.

import { useEffect, useState } from 'react';
import type { Calibration } from '../calibration/calibrationStore';
import { ClockFace } from '../clock/ClockFace';
import { fromHM, toHM } from '../clock/geometry';
import { LEVELS } from '../learn/levels';
import { speak } from '../speech';
import type { Progress } from '../store';
import { timeToDigital, timeToWords } from '../time/words';
import { V } from '../voice/lines';
import { Words } from './TimeLabel';

function TimeCard({ h, m, extra, onSay }: { h: number; m: number; extra?: string; onSay: () => void }) {
  return (
    <div className="timecard">
      <div className="timecard__words">
        <Words text={timeToWords(h, m)} />
      </div>
      <div className="timecard__digital">
        {timeToDigital(h, m)}
        {extra && <span className="timecard__extra"> {extra}</span>}
      </div>
      <button className="primary timecard__say" onClick={onSay} aria-label="Say the time">
        🔊
      </button>
    </div>
  );
}

/** Drag the hands anywhere; the time is said when she lets go. */
export function FreePlay({ calibration, onHome }: { calibration: Calibration; onHome: () => void }) {
  const [minutes, setMinutes] = useState(fromHM(10, 10));
  const [live, setLive] = useState<{ h: number; m: number } | null>(null);
  const [fives, setFives] = useState(false);
  const { h, m } = live ?? toHM(minutes);
  const say = (t = { h, m }) => speak(V.itsTime(t.h, t.m));

  return (
    <div className="screen play">
      <header className="topbar">
        <button onClick={onHome} aria-label="Home">
          🏠
        </button>
        <div className="topbar__level">
          <span>🎨</span>
          <span className="topbar__title">Free play</span>
        </div>
        <button className="topbar__right" aria-pressed={fives} onClick={() => setFives((f) => !f)} aria-label="Show the fives">
          🖐️
        </button>
      </header>
      <div className="stage">
        <div className="stage__clock">
          <ClockFace
            calibration={calibration}
            minutes={minutes}
            interactive={{ hour: true, minute: true }}
            helpers={{ fives: fives ? 1 : 0 }}
            onChange={(mm) => setLive(toHM(mm))}
            onRelease={(mm) => {
              setLive(null);
              setMinutes(mm);
              say(toHM(mm));
            }}
          />
        </div>
        <div className="stage__side">
          <h2 className="prompt">👆 Move the hands, Aria!</h2>
          <TimeCard h={h} m={m} onSay={() => say()} />
        </div>
      </div>
    </div>
  );
}

function partOfDay(hour24: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour24 >= 5 && hour24 < 12) return 'morning';
  if (hour24 >= 12 && hour24 < 17) return 'afternoon';
  if (hour24 >= 17 && hour24 < 20) return 'evening';
  return 'night';
}

const PART_ICON = { morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌙' };

/** The real time right now, on her watch, with a ticking second hand. */
export function RealTime({ calibration, onHome }: { calibration: Calibration; onHome: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hour24 = now.getHours();
  const { h, m } = toHM(fromHM(hour24, now.getMinutes()));
  const part = partOfDay(hour24);
  const say = () => speak(V.timeNow(h, m, part));
  useEffect(() => {
    const t = setTimeout(say, 400);
    return () => clearTimeout(t);
    // Say it once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen play">
      <header className="topbar">
        <button onClick={onHome} aria-label="Home">
          🏠
        </button>
        <div className="topbar__level">
          <span>⌚</span>
          <span className="topbar__title">What time is it now?</span>
        </div>
      </header>
      <div className="stage">
        <div className="stage__clock">
          <ClockFace calibration={calibration} minutes={fromHM(hour24, now.getMinutes()) + now.getSeconds() / 60} seconds={now.getSeconds()} showSecond animateMs={0} />
        </div>
        <div className="stage__side">
          <h2 className="prompt">
            {PART_ICON[part]} It's {part === 'night' ? 'night time' : `the ${part}`}
          </h2>
          <TimeCard h={h} m={m} onSay={say} />
          <p className="hint">Look at your watch, Aria. Does it say the same?</p>
        </div>
      </div>
    </div>
  );
}

/** Every sticker, earned ones in colour. */
export function StickerBook({ progress, onHome }: { progress: Progress; onHome: () => void }) {
  return (
    <div className="screen">
      <header className="topbar">
        <button onClick={onHome} aria-label="Home">
          🏠
        </button>
        <div className="topbar__level">
          <span>📒</span>
          <span className="topbar__title">Aria's sticker book</span>
        </div>
        <div className="topbar__stars">
          {progress.stickers.length} / {LEVELS.length}
        </div>
      </header>
      <div className="stickers">
        {LEVELS.map((l) => {
          const got = progress.stickers.includes(l.id);
          return (
            <button
              key={l.id}
              className={`sticker ${got ? 'sticker--got' : ''}`}
              onClick={() => got && speak(V.levelUp(l.id))}
              aria-label={got ? l.sticker.name : `Locked: finish ${l.title}`}
            >
              <span className="sticker__emoji">{got ? l.sticker.emoji : '❔'}</span>
              <span className="sticker__name">{got ? l.sticker.name : l.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
