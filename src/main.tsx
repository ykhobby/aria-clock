import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calibration } from './calibration/Calibration';
import { loadCalibration } from './calibration/calibrationStore';
import { ClockCheck } from './ClockCheck';
import { setSpeechEnabled, unlockSpeech } from './speech';
import { loadProgress, saveProgress, type Progress } from './store';
import { Home } from './ui/Home';
import { FreePlay, RealTime, StickerBook } from './ui/Modes';
import { Parent } from './ui/Parent';
import { Play } from './ui/Play';
import './styles.css';
import './ui/ui.css';

type Route = 'home' | 'play' | 'parent' | 'calibrate' | 'check' | 'free' | 'now' | 'stickers';

function App() {
  const [calibration, setCalibration] = useState(loadCalibration);
  const [progress, setProgressState] = useState(loadProgress);
  const [route, setRoute] = useState<Route>('home');
  const [playKey, setPlayKey] = useState(0);

  const setProgress = (p: Progress) => {
    setProgressState(p);
    saveProgress(p);
  };

  useEffect(() => setSpeechEnabled(progress.settings.voice), [progress.settings.voice]);

  switch (route) {
    case 'calibrate':
      return (
        <Calibration
          initial={calibration}
          onDone={(c) => {
            setCalibration(c);
            setRoute('parent');
          }}
          onCancel={() => setRoute('parent')}
        />
      );
    case 'check':
      return <ClockCheck calibration={calibration} onCalibrate={() => setRoute('calibrate')} onBack={() => setRoute('parent')} />;
    case 'parent':
      return (
        <Parent
          progress={progress}
          onProgress={setProgress}
          onClose={() => setRoute('home')}
          onCalibrate={() => setRoute('calibrate')}
          onClockCheck={() => setRoute('check')}
        />
      );
    case 'free':
      return <FreePlay calibration={calibration} onHome={() => setRoute('home')} />;
    case 'now':
      return <RealTime calibration={calibration} onHome={() => setRoute('home')} />;
    case 'stickers':
      return <StickerBook progress={progress} onHome={() => setRoute('home')} />;
    case 'play':
      return <Play key={playKey} progress={progress} onProgress={setProgress} calibration={calibration} onHome={() => setRoute('home')} />;
    default:
      return (
        <Home
          progress={progress}
          onPlay={(id) => {
            unlockSpeech();
            setProgress({ ...progress, current: id });
            setPlayKey((k) => k + 1);
            setRoute('play');
          }}
          onParent={() => setRoute('parent')}
          onMode={(mode) => {
            unlockSpeech();
            setRoute(mode);
          }}
        />
      );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
