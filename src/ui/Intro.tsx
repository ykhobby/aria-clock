// A short narrated intro before each level: the clock moves while the voice explains.

import { useEffect, useState } from 'react';
import type { Calibration } from '../calibration/calibrationStore';
import { ClockFace, type ClockHelpers } from '../clock/ClockFace';
import type { HandName } from '../clock/drag';
import type { LevelDef } from '../learn/levels';
import { sayAndWait, stopSpeaking } from '../speech';
import { V, plain } from '../voice/lines';

interface Shown {
  minutes: number;
  highlight: HandName | 'both' | null;
  highlightNumber: number | null;
  helpers: ClockHelpers;
  say: string;
}

export function Intro({ level, calibration, onDone }: { level: LevelDef; calibration: Calibration; onDone: () => void }) {
  const [shown, setShown] = useState<Shown>({ minutes: level.intro[0]?.minutes ?? 0, highlight: null, highlightNumber: null, helpers: {}, say: '' });
  const [finished, setFinished] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    // One flag per run: React may start a run, cancel it and start again, and the
    // old loop must stop rather than keep talking alongside the new one.
    let cancelled = false;
    setFinished(false);
    // Start on the next tick so a run that's cancelled straight away never speaks.
    const start = setTimeout(async () => {
      let minutes = level.intro[0]?.minutes ?? 0;
      for (const [i, step] of level.intro.entries()) {
        if (cancelled) return;
        if (step.minutes != null) minutes = step.minutes;
        setShown({
          minutes,
          highlight: step.highlight ?? null,
          highlightNumber: step.highlightNumber ?? null,
          helpers: step.helpers ?? {},
          say: plain(step.say),
        });
        // Let a hand movement start before the words.
        if (step.minutes != null) await new Promise((r) => setTimeout(r, 500));
        await sayAndWait(V.intro(level.id, i), 1600);
      }
      if (!cancelled) setFinished(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(start);
      stopSpeaking();
    };
  }, [level, run]);

  return (
    <div className="screen intro">
      <div className="intro__title">
        <span className="intro__icon">{level.icon}</span>
        <h1>{level.title}</h1>
      </div>
      <div className="stage">
        <div className="stage__clock">
          <ClockFace
            calibration={calibration}
            minutes={shown.minutes}
            highlight={shown.highlight}
            highlightNumber={shown.highlightNumber}
            helpers={shown.helpers}
            animateMs={900}
          />
        </div>
        <div className="stage__side">
          <p className="intro__say" aria-live="polite">
            {shown.say}
          </p>
          <div className="intro__buttons">
            {finished ? (
              <>
                <button onClick={() => setRun((r) => r + 1)} aria-label="Watch again">
                  🔁
                </button>
                <button className="primary big" onClick={onDone}>
                  Let's go! ▶
                </button>
              </>
            ) : (
              <button onClick={onDone} aria-label="Skip">
                Skip ⏭
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
