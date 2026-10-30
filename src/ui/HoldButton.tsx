// Parent gate: the button only works if held down for 3 seconds.

import { useRef, useState, type ReactNode } from 'react';

export function HoldButton({ onHold, label, children, ms = 3000 }: { onHold: () => void; label: string; children: ReactNode; ms?: number }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onHold();
    }, ms);
  };
  const stop = () => {
    setHolding(false);
    window.clearTimeout(timer.current);
  };

  return (
    <button
      className={`hold ${holding ? 'hold--on' : ''}`}
      style={{ ['--hold-ms' as string]: `${ms}ms` }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
    >
      <span className="hold__ring" aria-hidden />
      {children}
    </button>
  );
}
