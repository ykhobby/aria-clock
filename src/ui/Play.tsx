// The question loop: ask → answer → warm feedback → next. Handles helpers,
// warm-up rounds, level-ups and the end of a session.

import { useEffect, useRef, useState } from 'react';
import type { Calibration } from '../calibration/calibrationStore';
import { ClockFace, numeralColour, type ClockHelpers } from '../clock/ClockFace';
import type { HandName } from '../clock/drag';
import { fromHM } from '../clock/geometry';
import { afterWarmup, checkSet, nextQuestion, recordAnswer, type AnswerEvents, type Question } from '../learn/engine';
import {
  explainAmpm,
  explainCount5,
  explainDetective,
  explainMatch,
  explainPlus,
  explainType,
  explainMeetHand,
  explainMeetNumber,
  explainRead,
  explainSet,
  praise,
  type Explanation,
} from '../learn/explain';
import type { TimeOption } from '../learn/distractors';
import { LEVELS } from '../learn/levels';
import { LIFE_AMPM, LIFE_SET } from '../learn/life';
import { skillOf } from '../learn/skills';
import { MatchBoard, NumberPad } from './Answers';
import { replay, speak, stopSpeaking } from '../speech';
import { levelProgress, type Progress } from '../store';
import { Intro } from './Intro';
import { V, plain, type Line } from '../voice/lines';
import { TimeLabel, Words } from './TimeLabel';
import { timeToWords } from '../time/words';

type Phase =
  | { t: 'intro' }
  | { t: 'ask' }
  | { t: 'right' }
  | { t: 'wrong'; ex: Explanation }
  | { t: 'warmupOffer' }
  | { t: 'levelUp'; cleared: number; next: number | null }
  | { t: 'sessionDone' };

interface Props {
  progress: Progress;
  onProgress: (p: Progress) => void;
  calibration: Calibration;
  onHome: () => void;
}

const WARMUP_SIZE = 4;

function promptSpeech(q: Question): Line[] {
  switch (q.kind) {
    case 'read':
      return [V.whatTime];
    case 'set':
      return [q.hourOnly ? V.makeShort(q.h, q.m) : V.showMe(q.h, q.m)];
    case 'detective':
      return [V.detective];
    case 'meet-hand':
      return [q.hand === 'hour' ? V.tapShort : V.tapLong];
    case 'meet-number':
      return [V.findNumber(q.number!)];
    case 'match':
      return [V.matchPrompt];
    case 'type':
      return [V.typeTime];
    case 'count5':
      return [V.count5];
    case 'life-set':
      return [V.lifeSet(q.scenario!)];
    case 'life-plus':
      return [V.plus(q.plus!)];
    case 'life-ampm':
      return [V.lifeAmpm(q.scenario!)];
  }
}

/** What to say after a right answer. */
function praiseSpeech(q: Question): Line[] {
  switch (q.kind) {
    case 'count5':
      return [praise(), V.minutes(q.m)];
    case 'life-ampm':
      return [praise(), q.ampm === 'morning' ? V.morning : V.afternoon];
    case 'life-plus':
      return [praise(), V.willBeTime(q.h, q.m)];
    case 'detective':
    case 'meet-hand':
    case 'meet-number':
    case 'match':
      return [praise()];
    default:
      return [praise(), V.itsTime(q.h, q.m)];
  }
}

export function Play({ progress, onProgress, calibration, onHome }: Props) {
  const latest = useRef(progress);
  latest.current = progress;
  const [phase, setPhase] = useState<Phase>({ t: 'intro' });
  const [q, setQ] = useState<Question | null>(null);
  const [setMin, setSetMin] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  /** Attempts at the current question. Only the first counts; after a wrong
   *  answer she sees the correction and tries again until she gets it. */
  const [tries, setTries] = useState(0);
  const pending = useRef<AnswerEvents>({});
  const warmupLeft = useRef(0);
  const helpersNote = useRef(false);
  const session = useRef({ start: Date.now(), deadline: Date.now() + progress.settings.sessionMinutes * 60_000 });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    // Next tick, so React's dev-mode double start doesn't speak twice.
    const t = setTimeout(startLevel, 0);
    return () => {
      clearTimeout(t);
      alive.current = false;
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = LEVELS[progress.current];
  const format = progress.settings.answerFormat;

  function save(p: Progress) {
    latest.current = p;
    onProgress(p);
  }

  function startLevel() {
    const p = latest.current;
    if (!p.introSeen.includes(p.current) && LEVELS[p.current].intro.length) setPhase({ t: 'intro' });
    else ask();
  }

  function finishIntro() {
    const p = latest.current;
    if (!p.introSeen.includes(p.current)) save({ ...p, introSeen: [...p.introSeen, p.current] });
    ask();
  }

  function ask() {
    if (Date.now() > session.current.deadline) {
      setPhase({ t: 'sessionDone' });
      speak(V.sessionDone);
      return;
    }
    const next = nextQuestion(latest.current, Math.random, { last: q ?? undefined, warmup: warmupLeft.current > 0 });
    setQ(next);
    setSetMin(next.start ?? fromHM(next.h, next.m));
    setChosen(null);
    setTries(0);
    setPhase({ t: 'ask' });
    const intro = helpersNote.current ? [V.helpersOn] : [];
    helpersNote.current = false;
    speak([...intro, ...promptSpeech(next)]);
  }

  function logSession(p: Progress, correct: boolean): Progress {
    const start = session.current.start;
    const sessions = [...p.sessions];
    const i = sessions.findIndex((s) => s.start === start);
    const cur = i >= 0 ? sessions[i] : { start, end: start, answered: 0, correct: 0, levels: [] as number[] };
    const updated = {
      ...cur,
      end: Date.now(),
      answered: cur.answered + 1,
      correct: cur.correct + (correct ? 1 : 0),
      levels: cur.levels.includes(p.current) ? cur.levels : [...cur.levels, p.current],
    };
    if (i >= 0) sessions[i] = updated;
    else sessions.push(updated);
    return { ...p, sessions: sessions.slice(-60) };
  }

  async function answer(correct: boolean, ex?: Explanation, missedAs?: { h: number; m: number }) {
    if (!q || phase.t !== 'ask') return;
    const firstTry = tries === 0;
    setTries((t) => t + 1);
    if (firstTry) {
      // For a mismatched pair, log the time she mixed up rather than the first one.
      const { progress: np, events } = recordAnswer(latest.current, missedAs ? { ...q, ...missedAs, skill: skillOf(missedAs.m) } : q, correct);
      if (q.warmup) warmupLeft.current = Math.max(0, warmupLeft.current - 1);
      if (events.helpersOn) helpersNote.current = true;
      pending.current = events;
      save(logSession(np, correct));
    }

    if (correct) {
      setPhase({ t: 'right' });
      if (firstTry) setBurst((b) => b + 1); // stars only for getting it first time
      await speak(firstTry ? praiseSpeech(q) : [V.fixedIt, ...praiseSpeech(q).slice(1)]);
      await new Promise((r) => setTimeout(r, 500));
      if (alive.current) proceed(q.warmup);
    } else {
      setPhase({ t: 'wrong', ex: ex! });
      speak(ex!.say);
    }
  }

  function proceed(wasWarmup = q?.warmup) {
    const ev = pending.current;
    pending.current = {};
    if (ev.levelUp) {
      setPhase({ t: 'levelUp', ...ev.levelUp });
      speak(V.levelUp(ev.levelUp.cleared));
      return;
    }
    if (ev.offerWarmup) {
      setPhase({ t: 'warmupOffer' });
      speak(V.warmupOffer);
      return;
    }
    if (wasWarmup && warmupLeft.current === 0) {
      save(afterWarmup(latest.current));
      speak(V.warmupDone).then(() => alive.current && ask());
      return;
    }
    ask();
  }

  /** Same question again, answer hidden and choices shuffled, so she finds it herself. */
  function tryAgain() {
    if (!q) return;
    const mix = <T,>(a?: T[]) => (a ? [...a].sort(() => Math.random() - 0.5) : a);
    setQ({ ...q, options: mix(q.options), numbers: mix(q.numbers), counts: mix(q.counts) });
    setSetMin(q.start ?? fromHM(q.h, q.m));
    setChosen(null);
    setPhase({ t: 'ask' });
    speak([V.tryAgain, ...promptSpeech(q)]);
  }

  // ---- answer handlers -------------------------------------------------
  const pickOption = (o: TimeOption) => {
    if (!q) return;
    setChosen(`${o.h}:${o.m}`);
    const ok = o.h === q.h && o.m === q.m;
    answer(ok, ok ? undefined : explainRead(q, o));
  };
  const submitSet = () => q && answer(checkSet(q, setMin), checkSet(q, setMin) ? undefined : explainSet(q, setMin));
  const pickNumber = (n: number) => {
    if (!q) return;
    setChosen(String(n));
    const ok = n === q.h;
    answer(ok, ok ? undefined : explainDetective(q));
  };
  const pickCount = (n: number) => {
    if (!q) return;
    setChosen(String(n));
    answer(n === q.m, n === q.m ? undefined : explainCount5(q));
  };
  const typed = (t: { h: number; m: number }) => {
    if (!q) return;
    setChosen(`${t.h}:${t.m}`);
    const ok = t.h === q.h && t.m === q.m;
    answer(ok, ok ? undefined : explainType(q, t));
  };
  const matched = (firstWrong: TimeOption | null) => answer(!firstWrong, firstWrong ? explainMatch() : undefined, firstWrong ?? undefined);
  const pickPlus = (o: TimeOption) => {
    if (!q) return;
    setChosen(`${o.h}:${o.m}`);
    const ok = o.h === q.h && o.m === q.m;
    answer(ok, ok ? undefined : explainPlus(q));
  };
  const pickAmpm = (a: 'morning' | 'afternoon') => {
    if (!q) return;
    setChosen(a);
    answer(a === q.ampm, a === q.ampm ? undefined : explainAmpm(q));
  };
  const tapHand = (hand: HandName) => q && answer(hand === q.hand, hand === q.hand ? undefined : explainMeetHand(q));
  const tapNumber = (n: number) => {
    if (!q) return;
    setChosen(String(n));
    answer(n === q.number, n === q.number ? undefined : explainMeetNumber(q));
  };

  // ---- screens ------------------------------------------------------------
  if (phase.t === 'intro') return <Intro level={level} calibration={calibration} onDone={finishIntro} />;

  if (phase.t === 'levelUp') {
    const l = LEVELS[phase.cleared];
    return (
      <div className="screen celebrate">
        <div className="confetti" aria-hidden />
        <div className="celebrate__sticker">{l.sticker.emoji}</div>
        <h1>Hooray, Aria!</h1>
        <p className="celebrate__text">
          You finished <b>{l.title}</b> and won <b>{l.sticker.name}</b>!
        </p>
        <div className="row center">
          <button onClick={onHome}>🏠 Map</button>
          {phase.next != null ? (
            <button className="primary big" onClick={() => startLevel()}>
              Next level {LEVELS[phase.next].icon} ▶
            </button>
          ) : (
            <button className="primary big" onClick={() => ask()}>
              Keep playing ▶
            </button>
          )}
        </div>
        {phase.next == null && <p className="celebrate__note">You've finished every level, Aria! You can read any clock now. 🌈</p>}
      </div>
    );
  }

  if (phase.t === 'warmupOffer') {
    return (
      <div className="screen celebrate">
        <div className="celebrate__sticker">🌟</div>
        <h1>You're working so hard!</h1>
        <p className="celebrate__text">Shall we do a quick warm-up with some easier ones?</p>
        <div className="row center">
          <button
            className="primary big"
            onClick={() => {
              warmupLeft.current = WARMUP_SIZE;
              ask();
            }}
          >
            🌟 Warm up!
          </button>
          <button className="big" onClick={() => ask()}>
            Keep going ▶
          </button>
        </div>
      </div>
    );
  }

  if (phase.t === 'sessionDone') {
    const s = progress.sessions.find((x) => x.start === session.current.start);
    return (
      <div className="screen celebrate">
        <div className="celebrate__sticker">🦄</div>
        <h1>Great clock work today, Aria!</h1>
        <p className="celebrate__text">You earned {s?.correct ?? 0} ⭐ today.</p>
        <div className="row center">
          <button className="primary big" onClick={onHome}>
            🏠 All done
          </button>
          <button
            className="big"
            onClick={() => {
              session.current.deadline = Date.now() + progress.settings.sessionMinutes * 60_000;
              ask();
            }}
          >
            Keep playing ▶
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const time = fromHM(q.h, q.m);
  const asking = phase.t === 'ask';
  const ex = phase.t === 'wrong' ? phase.ex : null;
  // After two misses on the same question, the helpers come on for her next go.
  const helper = q.warmup || tries >= 2 ? 1 : q.review ? 0 : levelProgress(progress, q.level).helper;
  const lp = levelProgress(progress, progress.current);
  const goal = progress.settings.mastery;
  const got = Math.min(goal, lp.recent.filter(Boolean).length);

  const isSet = q.kind === 'set' || q.kind === 'life-set';
  let clockMinutes = q.clock ?? time;
  if (isSet) clockMinutes = ex ? time : setMin;
  // life-plus: after a wrong answer, move the hands on to show the answer.
  if (q.kind === 'life-plus' && ex) clockMinutes = q.clock! + q.plus!;

  let helpers: ClockHelpers = {};
  if (asking && helper > 0) {
    if (isSet) helpers = { ghostMinutes: time, hourSector: q.m ? helper * 0.5 : 0 };
    else if (q.kind === 'read' || q.kind === 'detective' || q.kind === 'type') helpers = { hourSector: q.m ? helper * 0.7 : 0 };
  }
  // Levels 10–13: the big 5s ring starts on and fades as she gets them right.
  const fivesLevel = q.level >= 10 && q.level <= 13 && q.skill !== 'meet';
  const fives = fivesLevel || q.kind === 'count5' ? Math.max(helper, fivesLevel && !q.review ? 1 - got / goal : 0) : 0;
  if (fives > 0) helpers = { ...helpers, fives };
  if (ex?.hourSector) helpers = { ...helpers, hourSector: 1 };
  if (ex?.fives) helpers = { ...helpers, fives: 1 };

  return (
    <div className="screen play">
      <header className="topbar">
        <button onClick={onHome} aria-label="Home">
          🏠
        </button>
        <div className="topbar__level">
          <span>{q.review ? '🔁' : q.warmup ? '🌟' : level.icon}</span>
          <span className="topbar__title">{q.review ? 'Remember this?' : q.warmup ? 'Warm-up' : level.title}</span>
        </div>
        <div className="meter" aria-label={`${got} of ${goal}`}>
          {Array.from({ length: goal }, (_, i) => (
            <span key={i} className={i < got ? 'meter__dot meter__dot--on' : 'meter__dot'} style={{ ['--i' as string]: i }} />
          ))}
        </div>
        <div className="topbar__stars">⭐ {progress.stars}</div>
        <button onClick={() => (ex ? speak(ex.say) : replay())} aria-label="Say it again">
          🔊
        </button>
      </header>

      <div className="stage">
        <div className="stage__clock">
          <ClockFace
            calibration={calibration}
            minutes={clockMinutes}
            interactive={asking && isSet ? { hour: true, minute: !q.hourOnly } : undefined}
            snapStep={q.snap ?? 1}
            onRelease={setSetMin}
            onHandTap={asking && q.kind === 'meet-hand' ? tapHand : undefined}
            onNumberTap={asking && q.kind === 'meet-number' ? tapNumber : undefined}
            highlight={ex?.highlight ?? null}
            highlightNumber={ex?.highlightNumber ?? null}
            helpers={helpers}
            animateMs={ex ? 1100 : 600}
          />
          {burst > 0 && phase.t === 'right' && (
            <div className="burst" key={burst} aria-hidden>
              <span>⭐</span>
              <span>⭐</span>
              <span>⭐</span>
              <span>✨</span>
              <span>⭐</span>
            </div>
          )}
        </div>

        <div className="stage__side">
          <Prompt q={q} format={format} />

          {(q.kind === 'read' || q.kind === 'life-plus') && (
            <div className="options">
              {q.options!.map((o) => {
                const k = `${o.h}:${o.m}`;
                const isRight = o.h === q.h && o.m === q.m;
                const cls = !asking && isRight ? 'option is-right' : !asking && chosen === k ? 'option is-chosen' : 'option';
                return (
                  <div className="option-row" key={k}>
                    <button className={cls} onClick={() => asking && (q.kind === 'life-plus' ? pickPlus(o) : pickOption(o))} disabled={!asking && !isRight}>
                      <TimeLabel h={o.h} m={o.m} wordsOnly={q.wordsOnly} format={format} />
                    </button>
                    <button className="say" onClick={() => speak(V.time(o.h, o.m))} aria-label={`Hear ${timeToWords(o.h, o.m)}`}>
                      🔈
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {q.kind === 'detective' && (
            <div className="numbers">
              {q.numbers!.map((n) => {
                const c = numeralColour(n);
                const cls = !asking && n === q.h ? 'number is-right' : !asking && chosen === String(n) ? 'number is-chosen' : 'number';
                return (
                  <button key={n} className={cls} style={{ color: c.fill, WebkitTextStroke: `2px ${c.stroke}` }} onClick={() => asking && pickNumber(n)}>
                    {n}
                  </button>
                );
              })}
            </div>
          )}

          {q.kind === 'count5' && (
            <div className="numbers">
              {q.counts!.map((n) => {
                const cls = !asking && n === q.m ? 'number number--wide is-right' : !asking && chosen === String(n) ? 'number number--wide is-chosen' : 'number number--wide';
                return (
                  <button key={n} className={cls} onClick={() => asking && pickCount(n)} aria-label={`${n} minutes`}>
                    {n}
                    <small>min</small>
                  </button>
                );
              })}
            </div>
          )}

          {q.kind === 'match' && asking && <MatchBoard key={`${q.key}-${tries}`} pairs={q.pairs!} onDone={matched} />}

          {q.kind === 'type' && <NumberPad key={`${q.key}-${tries}`} onSubmit={typed} disabled={!asking} />}

          {q.kind === 'life-ampm' && (
            <div className="ampm">
              {(['morning', 'afternoon'] as const).map((a) => {
                const cls = !asking && a === q.ampm ? 'ampm__btn is-right' : !asking && chosen === a ? 'ampm__btn is-chosen' : 'ampm__btn';
                return (
                  <div className="option-row" key={a}>
                    <button className={cls} onClick={() => asking && pickAmpm(a)}>
                      <span className="ampm__icon">{a === 'morning' ? '🌅' : '☀️'}</span>
                      {a === 'morning' ? 'Morning' : 'Afternoon'}
                    </button>
                    <button className="say" onClick={() => speak(a === 'morning' ? V.morning : V.afternoon)} aria-label={`Hear ${a}`}>
                      🔈
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isSet && asking && (
            <button className="primary done" onClick={submitSet} aria-label="I'm done">
              ✔
            </button>
          )}

          {ex && (
            <div className="feedback">
              <p className="feedback__text">
                <Words text={feedbackCaption(q)} />
                {!q.wordsOnly && q.skill !== 'meet' && q.kind !== 'count5' && q.kind !== 'match' && <span className="feedback__digital"> · {`${q.h}:${String(q.m).padStart(2, '0')}`}</span>}
              </p>
              <button className="primary big next" onClick={tryAgain} aria-label="Try again">
                🔁 Try again
              </button>
            </div>
          )}
          {phase.t === 'right' && <p className="praise">🎉</p>}
        </div>
      </div>
    </div>
  );
}

function feedbackCaption(q: Question): string {
  switch (q.kind) {
    case 'meet-hand':
      return q.hand === 'hour' ? 'This is the short hand 👉 hours' : 'This is the long hand 👉 minutes';
    case 'meet-number':
      return `Here is number ${q.number}`;
    case 'detective':
      return `The short hand has just gone past ${q.h}`;
    case 'count5':
      return `The long hand is on ${Math.round(q.m / 5)}: that's ${q.m} minutes`;
    case 'match':
      return 'Each time has its own numbers';
    case 'life-ampm':
      return q.ampm === 'morning' ? '🌅 It is in the morning' : '☀️ It is in the afternoon';
    case 'life-plus':
      return `It will be ${timeToWords(q.h, q.m)}`;
    default:
      return `It's ${timeToWords(q.h, q.m)}`;
  }
}

function Prompt({ q, format }: { q: Question; format: Progress['settings']['answerFormat'] }) {
  switch (q.kind) {
    case 'read':
      return <h2 className="prompt">What time is it? 🤔</h2>;
    case 'set':
      return (
        <h2 className="prompt">
          <span className="prompt__lead">{q.hourOnly ? '👆 Move the short hand' : '👆 Show me'}</span>
          <TimeLabel h={q.h} m={q.m} wordsOnly={q.wordsOnly} format={format} />
        </h2>
      );
    case 'detective':
      return <h2 className="prompt">🔍 Which number has the short hand just gone past?</h2>;
    case 'count5':
      return <h2 className="prompt">🖐️ How many minutes? Count by 5s!</h2>;
    case 'match':
      return <h2 className="prompt">🔗 Match each time to its numbers</h2>;
    case 'type':
      return <h2 className="prompt">⌨️ What time is it? Type it in!</h2>;
    case 'life-set': {
      const sc = LIFE_SET.find((x) => x.id === q.scenario)!;
      return (
        <h2 className="prompt">
          <span className="prompt__icon">{sc.icon}</span> {plain(sc.text).split('. ')[0]}.
          <TimeLabel h={q.h} m={q.m} format={format} />
        </h2>
      );
    }
    case 'life-plus':
      return (
        <h2 className="prompt">
          ⏩ What time will it be in <b className="hl">{q.plus === 60 ? 'one hour' : 'half an hour'}</b>?
        </h2>
      );
    case 'life-ampm': {
      const sc = LIFE_AMPM.find((x) => x.id === q.scenario)!;
      return (
        <h2 className="prompt">
          <span className="prompt__icon">{sc.icon}</span> {plain(sc.text).replace(/ Is that in the morning or the afternoon\?| Morning or afternoon\?/, '')}
          <span className="prompt__sub">Morning or afternoon?</span>
        </h2>
      );
    }
    case 'meet-hand':
      return (
        <h2 className="prompt">
          👆 Tap the <b className="hl">{q.hand === 'hour' ? 'short' : 'long'}</b> hand
          <HandIcon long={q.hand === 'minute'} />
        </h2>
      );
    case 'meet-number': {
      const c = numeralColour(q.number!);
      return (
        <h2 className="prompt">
          👆 Find number{' '}
          <b className="prompt__num" style={{ color: c.fill, WebkitTextStroke: `2px ${c.stroke}` }}>
            {q.number}
          </b>
        </h2>
      );
    }
  }
}

function HandIcon({ long }: { long: boolean }) {
  return (
    <svg className="hand-icon" viewBox="0 0 40 100" aria-hidden>
      <path
        d={long ? 'M 16 92 L 15 18 Q 20 2 25 18 L 24 92 Z' : 'M 14 92 L 12 52 Q 20 34 28 52 L 26 92 Z'}
        fill="#f7c5d3"
        stroke="#e3a1b4"
        strokeWidth={2}
      />
      <circle cx={20} cy={90} r={7} fill="#f7c5d3" stroke="#e3a1b4" strokeWidth={2} />
    </svg>
  );
}
