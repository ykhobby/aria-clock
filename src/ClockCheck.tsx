// Phase 1 check page: compare the drawn watch with the real one and try the hands.

import { useEffect, useState } from 'react';
import type { Calibration } from './calibration/calibrationStore';
import { ClockFace } from './clock/ClockFace';
import { fromHM, toHM, timeToAngles } from './clock/geometry';
import { speak, voiceName } from './speech';
import { timeToDigital, timeToWords } from './time/words';
import { V } from './voice/lines';
import './check.css';

type Mode = 'both' | 'hourOnly' | 'five';

const PRESETS: [number, number][] = [
  [3, 0],
  [3, 30],
  [3, 15],
  [3, 45],
  [10, 10],
  [12, 0],
];

export function ClockCheck({ calibration, onCalibrate, onBack }: { calibration: Calibration; onCalibrate: () => void; onBack: () => void }) {
  const [minutes, setMinutes] = useState(fromHM(10, 10));
  const [live, setLive] = useState<{ h: number; m: number } | null>(null);
  const [mode, setMode] = useState<Mode>('both');
  const [realTime, setRealTime] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [fives, setFives] = useState(false);
  const [sector, setSector] = useState(false);
  const [ghost, setGhost] = useState(false);

  // Real-time mode: follow the device clock with a ticking second hand.
  useEffect(() => {
    if (!realTime) return;
    const tick = () => {
      const d = new Date();
      setMinutes(fromHM(d.getHours(), d.getMinutes()));
      setSeconds(d.getSeconds());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [realTime]);

  const { h, m } = live ?? toHM(minutes);
  const angles = timeToAngles(h, m);

  const set = (mins: number) => {
    setRealTime(false);
    setLive(null);
    setMinutes(mode === 'hourOnly' ? Math.round(mins / 60) * 60 : mins);
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    if (next === 'hourOnly') setMinutes((x) => Math.round(x / 60) * 60);
  };

  return (
    <div className="check">
      <div className="check__clock">
        <ClockFace
          calibration={calibration}
          minutes={minutes}
          seconds={seconds}
          showSecond={realTime}
          interactive={realTime ? undefined : { hour: true, minute: mode !== 'hourOnly' }}
          snapStep={mode === 'five' ? 5 : 1}
          onChange={(mm) => setLive(toHM(mm))}
          onRelease={(mm) => {
            setLive(null);
            setMinutes(mm);
            const t = toHM(mm);
            speak(V.time(t.h, t.m));
          }}
          helpers={{ fives: fives ? 1 : 0, hourSector: sector ? 1 : 0, ghostMinutes: ghost ? fromHM(3, 30) : null }}
        />
      </div>

      <div className="check__panel">
        <div className="check__time">
          <div className="check__words">{timeToWords(h, m)}</div>
          <div className="check__digital">{timeToDigital(h, m)}</div>
          <button className="primary check__speak" onClick={() => speak(V.time(h, m))} aria-label="Say the time">
            🔊
          </button>
        </div>

        <section>
          <h2>Hands</h2>
          <div className="row">
            <button aria-pressed={mode === 'both'} onClick={() => chooseMode('both')}>Both hands</button>
            <button aria-pressed={mode === 'hourOnly'} onClick={() => chooseMode('hourOnly')}>Short hand only</button>
            <button aria-pressed={mode === 'five'} onClick={() => chooseMode('five')}>Snap to 5s</button>
            <button aria-pressed={realTime} onClick={() => setRealTime((r) => !r)}>Real time ⏱</button>
          </div>
        </section>

        <section>
          <h2>Try a time</h2>
          <div className="row">
            {PRESETS.map(([ph, pm]) => (
              <button key={`${ph}:${pm}`} onClick={() => set(fromHM(ph, pm))}>
                {timeToDigital(ph, pm)}
              </button>
            ))}
            <button onClick={() => set(minutes - 5)} aria-label="5 minutes back">−5</button>
            <button onClick={() => set(minutes + 5)} aria-label="5 minutes on">+5</button>
          </div>
        </section>

        <section>
          <h2>Helpers (later levels)</h2>
          <div className="row">
            <button aria-pressed={fives} onClick={() => setFives((x) => !x)}>5s ring</button>
            <button aria-pressed={sector} onClick={() => setSector((x) => !x)}>Hour gap</button>
            <button aria-pressed={ghost} onClick={() => setGhost((x) => !x)}>Ghost 3:30</button>
          </div>
        </section>

        <p className="check__debug">
          hour hand {angles.hour.toFixed(1)}° · minute hand {angles.minute.toFixed(1)}° · voice: {voiceName()}
        </p>
        <div className="row">
          <button onClick={onBack}>← Back</button>
          <button onClick={onCalibrate}>⚙️ Calibrate watch photo</button>
        </div>
      </div>
    </div>
  );
}
