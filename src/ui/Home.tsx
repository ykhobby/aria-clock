// Aria's rainbow path: every level is a stop, cleared stops show their sticker.

import { LEVELS } from '../learn/levels';
import type { Progress } from '../store';
import { HoldButton } from './HoldButton';

const COLS = 4;

function nodePos(i: number) {
  const row = Math.floor(i / COLS);
  const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  return { x: 12.5 + col * 25, y: 9 + row * 26 };
}

interface Props {
  progress: Progress;
  onPlay: (level: number) => void;
  onParent: () => void;
  onMode: (mode: 'free' | 'now' | 'stickers') => void;
}

export function Home({ progress, onPlay, onParent, onMode }: Props) {
  const pts = LEVELS.map((_, i) => nodePos(i));
  // A smooth serpentine through the stops.
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.y === b.y) d += ` L ${b.x} ${b.y}`;
    else {
      const bulge = a.x > 50 ? 10 : -10;
      d += ` C ${a.x + bulge} ${a.y} ${b.x + bulge} ${b.y} ${b.x} ${b.y}`;
    }
  }

  const current = LEVELS[progress.current];

  return (
    <div className="screen home">
      <header className="home__head">
        <div>
          <h1>Hi Aria! 🦄</h1>
          <p className="home__sub">
            ⭐ {progress.stars} &nbsp; · &nbsp; Stickers {progress.stickers.length}
          </p>
        </div>
        <button className="primary big home__play" onClick={() => onPlay(progress.current)}>
          ▶ Play <span className="home__playlevel">{current.icon}</span>
        </button>
      </header>

      <div className="map">
        <svg className="map__path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff9ec7" />
              <stop offset="0.2" stopColor="#ffc38a" />
              <stop offset="0.4" stopColor="#ffe68a" />
              <stop offset="0.6" stopColor="#a7ecc0" />
              <stop offset="0.8" stopColor="#9fd0ff" />
              <stop offset="1" stopColor="#c7a8ff" />
            </linearGradient>
          </defs>
          <path d={d} fill="none" stroke="url(#rainbow)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.8} />
        </svg>

        {LEVELS.map((l, i) => {
          const p = pts[i];
          const cleared = progress.stickers.includes(l.id);
          const unlocked = l.playable && l.id <= progress.level;
          const isCurrent = l.id === progress.current;
          const cls = ['stop', cleared && 'stop--cleared', isCurrent && 'stop--current', !unlocked && 'stop--locked'].filter(Boolean).join(' ');
          return (
            <button
              key={l.id}
              className={cls}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              disabled={!unlocked}
              onClick={() => onPlay(l.id)}
              aria-label={`${l.title}${cleared ? ', done' : unlocked ? '' : ', locked'}`}
            >
              {isCurrent && <span className="stop__aria">🦄</span>}
              <span className="stop__icon">{cleared ? l.sticker.emoji : unlocked ? l.icon : '🔒'}</span>
              <span className="stop__label">{l.title}</span>
            </button>
          );
        })}
      </div>

      <footer className="home__foot">
        <div className="home__modes">
          <button onClick={() => onMode('free')}>🎨 Free play</button>
          <button onClick={() => onMode('now')}>⌚ Time now</button>
          <button onClick={() => onMode('stickers')}>📒 Stickers</button>
        </div>
        <HoldButton onHold={onParent} label="Grown-ups: hold for 3 seconds">
          👪
        </HoldButton>
      </footer>
    </div>
  );
}
