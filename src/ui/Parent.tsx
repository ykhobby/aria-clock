// Grown-ups area: how Aria is doing, and settings.

import { useState } from 'react';
import { LEVELS } from '../learn/levels';
import { testDeviceVoice } from '../speech';
import { SKILLS, SKILL_LABELS } from '../learn/skills';
import { timeToWords } from '../time/words';
import { newProgress, newLevelProgress, type AnswerFormat, type Progress } from '../store';

interface Props {
  progress: Progress;
  onProgress: (p: Progress) => void;
  onClose: () => void;
  onCalibrate: () => void;
  onClockCheck: () => void;
}

export function Parent({ progress, onProgress, onClose, onCalibrate, onClockCheck }: Props) {
  const s = progress.settings;
  const [voiceTest, setVoiceTest] = useState('');
  const set = (patch: Partial<Progress['settings']>) => onProgress({ ...progress, settings: { ...s, ...patch } });

  const missed = Object.entries(progress.missed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const sessions = [...progress.sessions].reverse().slice(0, 12);

  const jump = (id: number) => {
    // Jumping ahead counts earlier levels as cleared so the map stays consistent.
    const stickers = [...new Set([...progress.stickers.filter((x) => x < id), ...LEVELS.filter((l) => l.id < id).map((l) => l.id)])];
    onProgress({ ...progress, level: id, current: id, stickers, levels: { ...progress.levels, [id]: newLevelProgress() } });
  };

  return (
    <div className="screen parent">
      <header className="parent__head">
        <h1>Grown-ups</h1>
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </header>

      <section className="card">
        <h2>Level (tap to jump)</h2>
        <p>
          Aria is on <b>{LEVELS[progress.level].icon} Level {progress.level}: {LEVELS[progress.level].title}</b> · ⭐ {progress.stars}
        </p>
        <div className="row">
          {LEVELS.filter((l) => l.playable).map((l) => (
            <button key={l.id} aria-pressed={progress.level === l.id} onClick={() => jump(l.id)}>
              {l.id}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Accuracy by skill</h2>
        <div className="skills">
          {SKILLS.map((k) => {
            const st = progress.skills[k];
            const total = st.right + st.wrong;
            const recent = st.recent.length ? Math.round((100 * st.recent.filter(Boolean).length) / st.recent.length) : null;
            const pct = total ? Math.round((100 * st.right) / total) : 0;
            return (
              <div className="skill" key={k}>
                <span className="skill__name">{SKILL_LABELS[k]}</span>
                <span className="skill__bar">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="skill__num">{total ? `${pct}%` : '—'}</span>
                <span className="skill__detail">{total ? `${st.right}/${total}${recent != null ? ` · last ${st.recent.length}: ${recent}%` : ''}` : 'not yet'}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Times she gets wrong most</h2>
        {missed.length ? (
          <div className="row">
            {missed.map(([t, n]) => {
              const [h, m] = t.split(':').map(Number);
              return (
                <span className="chip" key={t}>
                  <b>{t}</b> {timeToWords(h, m)} · {n}×
                </span>
              );
            })}
          </div>
        ) : (
          <p>Nothing yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Recent sessions</h2>
        {sessions.length ? (
          <table className="sessions">
            <thead>
              <tr>
                <th>When</th>
                <th>Minutes</th>
                <th>Answered</th>
                <th>Right</th>
                <th>Levels</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((x) => (
                <tr key={x.start}>
                  <td>{new Date(x.start).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>{Math.max(1, Math.round((x.end - x.start) / 60000))}</td>
                  <td>{x.answered}</td>
                  <td>{x.answered ? `${Math.round((100 * x.correct) / x.answered)}%` : '—'}</td>
                  <td>{x.levels.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No sessions yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Answer format (level 3 and up)</h2>
        <div className="row">
          {(
            [
              ['words', 'Words first'],
              ['digital', 'Digital first'],
              ['both', 'Both'],
            ] as [AnswerFormat, string][]
          ).map(([v, label]) => (
            <button key={v} aria-pressed={s.answerFormat === v} onClick={() => set({ answerFormat: v })}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Move up after</h2>
        <div className="row">
          {[6, 7, 8, 9, 10].map((n) => (
            <button key={n} aria-pressed={s.mastery === n} onClick={() => set({ mastery: n })}>
              {n} of 10
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Session length</h2>
        <div className="row">
          {[5, 8, 10, 15].map((n) => (
            <button key={n} aria-pressed={s.sessionMinutes === n} onClick={() => set({ sessionMinutes: n })}>
              {n} min
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Voice</h2>
        <div className="row">
          <button aria-pressed={s.voice} onClick={() => set({ voice: true })}>
            🔊 On
          </button>
          <button aria-pressed={!s.voice} onClick={() => set({ voice: false })}>
            🔇 Off
          </button>
          <button
            onClick={() => {
              setVoiceTest('Listening…');
              testDeviceVoice().then(setVoiceTest);
            }}
          >
            🔢 Test number voice
          </button>
        </div>
        {voiceTest && <pre className="voice-test">{voiceTest}</pre>}
      </section>

      <section className="card">
        <h2>Watch</h2>
        <div className="row">
          <button onClick={onCalibrate}>⚙️ Calibrate photo</button>
          <button onClick={onClockCheck}>🕰 Clock check page</button>
        </div>
      </section>

      <section className="card">
        <h2>Start over</h2>
        <button
          onClick={() => {
            if (confirm('Reset all of Aria\'s progress, stars and stickers?')) onProgress({ ...newProgress(), settings: s });
          }}
        >
          Reset progress
        </button>
      </section>
    </div>
  );
}
