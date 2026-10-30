// One-time parent setup: tap the middle of the dial, then drag the pink ring
// handle until the ring sits on the dark edge around the white dial.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ClockFace } from '../clock/ClockFace';
import { fromHM } from '../clock/geometry';
import { DEFAULT_CALIBRATION, saveCalibration, type Calibration as Cal } from './calibrationStore';
import './calibration.css';

interface Props {
  initial: Cal;
  onDone: (c: Cal) => void;
  onCancel: () => void;
}

const VIEW_HALF = 1.9; // dial radii of photo shown around the default dial

export function Calibration({ initial, onDone, onCancel }: Props) {
  const [cal, setCal] = useState<Cal>(initial);
  const [preview, setPreview] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'centre' | 'radius' | null>(null);

  const d = DEFAULT_CALIBRATION;
  const half = VIEW_HALF * d.r;
  const viewBox = `${d.cx - half} ${d.cy - half} ${half * 2} ${half * 2}`;

  const toPhoto = (e: ReactPointerEvent) => {
    const ctm = svgRef.current!.getScreenCTM()!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toPhoto(e);
    const handle = { x: cal.cx + cal.r, y: cal.cy };
    // The handle has a generous grab zone.
    dragging.current = Math.hypot(p.x - handle.x, p.y - handle.y) < cal.r * 0.25 ? 'radius' : 'centre';
    e.currentTarget.setPointerCapture(e.pointerId);
    move(p);
  };
  const move = (p: { x: number; y: number }) => {
    if (dragging.current === 'centre') setCal((c) => ({ ...c, cx: round(p.x), cy: round(p.y) }));
    if (dragging.current === 'radius') setCal((c) => ({ ...c, r: Math.max(30, round(Math.hypot(p.x - c.cx, p.y - c.cy))) }));
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => dragging.current && move(toPhoto(e));
  const onUp = () => (dragging.current = null);

  const nudge = (dx: number, dy: number, dr = 0) =>
    setCal((c) => ({ cx: round(c.cx + dx), cy: round(c.cy + dy), r: Math.max(30, round(c.r + dr)) }));

  const save = () => {
    saveCalibration(cal);
    onDone(cal);
  };

  const sw = d.r * 0.012;

  return (
    <div className="calib">
      <header className="calib__head">
        <h1>Set up the watch</h1>
        <p>
          <b>1.</b> Tap the middle of the dial. <b>2.</b> Drag the round handle until the ring sits on the dark edge
          around the white dial. <b>3.</b> Press <b>Check</b> to see the clock.
        </p>
      </header>

      <div className="calib__stage">
        {preview ? (
          <ClockFace calibration={cal} minutes={fromHM(3, 30)} interactive={{ hour: true, minute: true }} />
        ) : (
          <svg
            ref={svgRef}
            className="calib__svg"
            viewBox={viewBox}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <image href={`${import.meta.env.BASE_URL}watch.png`} x={0} y={0} width={1000} height={1000} />
            <circle cx={cal.cx} cy={cal.cy} r={cal.r} fill="rgba(255,105,180,0.08)" stroke="#ff2f86" strokeWidth={sw} strokeDasharray={`${sw * 3} ${sw * 2}`} />
            <line x1={cal.cx - cal.r * 0.15} y1={cal.cy} x2={cal.cx + cal.r * 0.15} y2={cal.cy} stroke="#ff2f86" strokeWidth={sw} />
            <line x1={cal.cx} y1={cal.cy - cal.r * 0.15} x2={cal.cx} y2={cal.cy + cal.r * 0.15} stroke="#ff2f86" strokeWidth={sw} />
            <circle cx={cal.cx + cal.r} cy={cal.cy} r={cal.r * 0.1} fill="#ff2f86" stroke="#fff" strokeWidth={sw * 1.5} />
          </svg>
        )}
      </div>

      <div className="calib__controls">
        {!preview && (
          <div className="calib__nudge" aria-label="Fine adjust">
            <button onClick={() => nudge(0, -0.5)} aria-label="Move up">⬆️</button>
            <button onClick={() => nudge(0, 0.5)} aria-label="Move down">⬇️</button>
            <button onClick={() => nudge(-0.5, 0)} aria-label="Move left">⬅️</button>
            <button onClick={() => nudge(0.5, 0)} aria-label="Move right">➡️</button>
            <button onClick={() => nudge(0, 0, -0.5)} aria-label="Smaller ring">➖</button>
            <button onClick={() => nudge(0, 0, 0.5)} aria-label="Bigger ring">➕</button>
          </div>
        )}
        <div className="calib__actions">
          <button onClick={() => setCal(DEFAULT_CALIBRATION)}>Reset</button>
          <button onClick={() => setPreview((p) => !p)}>{preview ? 'Adjust' : 'Check'}</button>
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </div>
        <p className="calib__readout">
          centre {cal.cx}, {cal.cy} · radius {cal.r}
        </p>
      </div>
    </div>
  );
}

const round = (n: number) => Math.round(n * 2) / 2;
