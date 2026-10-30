// Aria's watch: the photo supplies the silver case and pink strap, and the dial,
// numbers and hands are drawn on top in SVG so they stay sharp and can move.
// Everything inside the dial is drawn in "dial units": centre (0,0), crystal ring radius 1.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Calibration } from '../calibration/calibrationStore';
import { dragTo, pickHand, snapMinutes, startDrag, type DragState, type HandName } from './drag';
import { hourAngleFromMinutes, minuteAngleFromMinutes, pointToAngle, polar, wrapMinutes } from './geometry';
import './clock.css';

const NUMERAL_COLOURS: Record<number, { fill: string; stroke: string }> = {};
const CYCLE = [
  { fill: '#5470b2', stroke: '#2e3a5e' }, // blue   12, 4, 8
  { fill: '#ffe646', stroke: '#4a4030' }, // yellow  1, 5, 9
  { fill: '#0b8a47', stroke: '#1f2e24' }, // green   2, 6, 10
  { fill: '#f2b3c3', stroke: '#c98d9c' }, // pink    3, 7, 11
];
for (let n = 1; n <= 12; n++) NUMERAL_COLOURS[n] = CYCLE[n % 4];

/** The colour of hour number n on her watch. */
export const numeralColour = (n: number) => NUMERAL_COLOURS[n];

const HAND_PINK = '#f7c5d3';
const HAND_EDGE = '#e3a1b4';
const TRACK_PINK = '#f3a9bb';

export const NUMERAL_RADIUS = 0.67;
const VIEW_HALF = 1.45; // how much of the photo around the dial to show, in dial units

export interface ClockHelpers {
  /** 0–1: big "5, 10, 15…" labels around the edge */
  fives?: number;
  /** 0–1: shade the gap the hour hand is in (between this hour and the next) */
  hourSector?: number;
  /** show a dashed ghost of the hands at this time (total minutes) */
  ghostMinutes?: number | null;
}

export interface ClockFaceProps {
  calibration: Calibration;
  /** Time shown, as total minutes. Animates smoothly when it changes. */
  minutes: number;
  seconds?: number;
  showSecond?: boolean;
  /** Which hands she can drag. */
  interactive?: { hour: boolean; minute: boolean };
  /** Step the hands snap to when let go (1, 5, 15, 30, 60). */
  snapStep?: number;
  onChange?: (minutes: number) => void;
  onRelease?: (minutes: number) => void;
  onHandTap?: (hand: HandName) => void;
  onNumberTap?: (n: number) => void;
  highlight?: HandName | 'both' | null;
  /** Pulse a ring around one of the hour numbers. */
  highlightNumber?: number | null;
  helpers?: ClockHelpers;
  /** Animation length in ms for time changes (0 = jump). */
  animateMs?: number;
  className?: string;
}

function useTween(target: number, ms: number, frozen: boolean) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  valueRef.current = value;
  useEffect(() => {
    if (frozen) return;
    const from = valueRef.current;
    if (ms <= 0 || Math.abs(target - from) < 0.01) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = Math.min(1800, ms * Math.max(1, Math.sqrt(Math.abs(target - from) / 30)));
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      setValue(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, frozen]);
  return [value, setValue] as const;
}

export function ClockFace({
  calibration: cal,
  minutes,
  seconds = 0,
  showSecond = false,
  interactive,
  snapStep = 1,
  onChange,
  onRelease,
  onHandTap,
  onNumberTap,
  highlight = null,
  highlightNumber = null,
  helpers = {},
  animateMs = 600,
  className,
}: ClockFaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useTween(minutes, animateMs, dragging);

  const toDial = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = (p.x - cal.cx) / cal.r;
    const y = (p.y - cal.cy) / cal.r;
    return { x, y, dist: Math.hypot(x, y), angle: pointToAngle(0, 0, x, y) };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const pt = toDial(e);
    if (!pt || pt.dist > 1.15) return;
    const canDrag = interactive && (interactive.hour || interactive.minute);

    if (onNumberTap && !canDrag) {
      for (let n = 1; n <= 12; n++) {
        const c = polar(0, 0, NUMERAL_RADIUS, n * 30);
        if (Math.hypot(pt.x - c.x, pt.y - c.y) < 0.17) {
          onNumberTap(n);
          return;
        }
      }
    }
    if (onHandTap && !canDrag) {
      const hand = pickHand(pt.angle, pt.dist, shown, { hour: true, minute: true });
      if (hand) onHandTap(hand);
      return;
    }
    if (!canDrag) return;
    const hand = pickHand(pt.angle, pt.dist, shown, interactive!);
    if (!hand) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = dragTo(startDrag(hand, shown), pt.angle);
    setDragging(true);
    applyDrag();
  };

  const applyDrag = () => {
    const s = drag.current!;
    const locked = interactive && !interactive.minute;
    // Hour-only mode keeps the minute hand on 12 by stepping whole hours.
    const m = locked ? snapMinutes(s.minutes, 60) : s.minutes;
    setShown(m);
    onChange?.(wrapMinutes(snapMinutes(m, 1)));
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const pt = toDial(e);
    if (!pt || pt.dist < 0.08) return; // too close to the centre to know the direction
    drag.current = dragTo(drag.current, pt.angle);
    applyDrag();
  };

  const endDrag = () => {
    if (!drag.current) return;
    const locked = interactive && !interactive.minute;
    const snapped = snapMinutes(drag.current.minutes, locked ? 60 : snapStep);
    drag.current = null;
    setShown(snapped);
    setDragging(false);
    onRelease?.(wrapMinutes(snapped));
  };

  const hourA = hourAngleFromMinutes(shown);
  const minA = minuteAngleFromMinutes(shown);
  const secA = seconds * 6;
  const hourOfShown = Math.floor(wrapMinutes(shown) / 60) || 12;
  const ghost = helpers.ghostMinutes;

  const R = cal.r;
  const ringAt = highlightNumber != null ? polar(0, 0, NUMERAL_RADIUS * R, highlightNumber * 30) : null;
  const half = VIEW_HALF * R;
  const viewBox = `${cal.cx - half} ${cal.cy - half} ${half * 2} ${half * 2}`;
  const draggable = !!interactive && (interactive.hour || interactive.minute);

  return (
    <svg
      ref={svgRef}
      className={`clock ${draggable ? 'clock--drag' : ''} ${className ?? ''}`}
      viewBox={viewBox}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="Aria's watch"
    >
      <defs>
        <radialGradient id="dialShade" cx="50%" cy="45%" r="55%">
          <stop offset="80%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eceaee" />
        </radialGradient>
        <filter id="handShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0.012" dy="0.02" stdDeviation="0.012" floodColor="#6b4a55" floodOpacity="0.35" />
        </filter>
      </defs>

      <image href={`${import.meta.env.BASE_URL}watch.png`} x={0} y={0} width={1000} height={1000} />

      {/* Dial shapes, in dial units */}
      <g transform={`translate(${cal.cx} ${cal.cy}) scale(${R})`}>
        {/* Dial and crystal edge (covers the photo's printed hands) */}
        <circle r={0.99} fill="url(#dialShade)" />
        <circle r={1} fill="none" stroke="#4b4a4d" strokeWidth={0.035} />

        {/* Helper: the gap the hour hand is in */}
        {!!helpers.hourSector && (
          <path
            className="helper"
            d={sectorPath((hourOfShown % 12) * 30, (hourOfShown % 12) * 30 + 30, 0.8)}
            fill="#ffe646"
            opacity={0.45 * helpers.hourSector}
          />
        )}

        {/* Minute track ticks */}
        {Array.from({ length: 60 }, (_, i) =>
          i % 5 === 0 ? null : (
            <line key={i} {...lineAt(i * 6, 0.845, 0.89)} stroke={TRACK_PINK} strokeWidth={0.011} strokeLinecap="round" />
          ),
        )}
      </g>

      {/* Text, in photo pixels (tiny font sizes in scaled groups render badly in Safari) */}
      <g transform={`translate(${cal.cx} ${cal.cy})`}>
        {Array.from({ length: 12 }, (_, i) => {
          const n = (i + 1) * 5;
          const a = n * 6;
          const p = polar(0, 0, 0.868 * R, a);
          const rot = a > 90 && a < 270 ? a + 180 : a;
          return (
            <text key={n} x={p.x} y={p.y} transform={`rotate(${rot} ${p.x} ${p.y})`} className="track-num" fill={TRACK_PINK} fontSize={0.062 * R}>
              {n}
            </text>
          );
        })}

        {/* Helper: big 5s */}
        {!!helpers.fives &&
          Array.from({ length: 12 }, (_, i) => {
            const n = (i + 1) * 5;
            const p = polar(0, 0, 0.865 * R, n * 6);
            return (
              <g key={n} className="helper" opacity={helpers.fives}>
                <circle cx={p.x} cy={p.y} r={0.085 * R} fill="#fff" stroke="#e98aa5" strokeWidth={0.012 * R} />
                <text x={p.x} y={p.y} className="five-num" fontSize={0.085 * R}>
                  {n === 60 ? 0 : n}
                </text>
              </g>
            );
          })}

        {ringAt && <circle className="number-ring" cx={ringAt.x} cy={ringAt.y} r={0.15 * R} strokeWidth={0.03 * R} />}

        {/* Hour numerals */}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const p = polar(0, 0, NUMERAL_RADIUS * R, n * 30);
          const c = NUMERAL_COLOURS[n];
          return (
            <text key={n} x={p.x} y={p.y} className="numeral" fill={c.fill} stroke={c.stroke} fontSize={0.27 * R} strokeWidth={0.015 * R}>
              {n}
            </text>
          );
        })}

        <text x={0} y={-0.31 * R} className="wordmark" fontSize={0.075 * R} letterSpacing={0.045 * R}>
          ARIA
        </text>
      </g>

      {/* Hands, in dial units */}
      <g transform={`translate(${cal.cx} ${cal.cy}) scale(${R})`}>
        {/* Helper: ghost hands showing where they should go */}
        {ghost != null && (
          <g className="ghost">
            <path d={HOUR_PATH} transform={`rotate(${hourAngleFromMinutes(ghost)})`} />
            <path d={MINUTE_PATH} transform={`rotate(${minuteAngleFromMinutes(ghost)})`} />
          </g>
        )}

        <g filter="url(#handShadow)">
          <g transform={`rotate(${hourA})`} className={highlightClass(highlight, 'hour')}>
            <path d={HOUR_PATH} className="hand-glow" />
            <path d={HOUR_PATH} fill={HAND_PINK} stroke={HAND_EDGE} strokeWidth={0.01} strokeLinejoin="round" />
          </g>
          <g transform={`rotate(${minA})`} className={highlightClass(highlight, 'minute')}>
            <path d={MINUTE_PATH} className="hand-glow" />
            <path d={MINUTE_PATH} fill={HAND_PINK} stroke={HAND_EDGE} strokeWidth={0.01} strokeLinejoin="round" />
          </g>
          {showSecond && (
            <g transform={`rotate(${secA})`}>
              <line x1={0} y1={0.2} x2={0} y2={-0.84} stroke={HAND_PINK} strokeWidth={0.013} strokeLinecap="round" />
              <line x1={0} y1={0.2} x2={0} y2={-0.84} stroke={HAND_EDGE} strokeWidth={0.004} opacity={0.6} />
            </g>
          )}
          <circle r={0.058} fill={HAND_PINK} stroke={HAND_EDGE} strokeWidth={0.012} />
          <circle r={0.02} fill="#e7a4b7" />
        </g>
      </g>
    </svg>
  );
}

// Slim tapered batons with a soft point, like the hands on her watch.
const HOUR_PATH = 'M -0.024 0.1 L -0.042 -0.34 Q 0 -0.5 0.042 -0.34 L 0.024 0.1 Q 0 0.13 -0.024 0.1 Z';
const MINUTE_PATH = 'M -0.017 0.12 L -0.027 -0.66 Q 0 -0.83 0.027 -0.66 L 0.017 0.12 Q 0 0.15 -0.017 0.12 Z';

function highlightClass(h: ClockFaceProps['highlight'], hand: HandName) {
  return h === hand || h === 'both' ? 'hand hand--highlight' : 'hand';
}

function lineAt(angle: number, r1: number, r2: number) {
  const a = polar(0, 0, r1, angle);
  const b = polar(0, 0, r2, angle);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function sectorPath(a1: number, a2: number, r: number) {
  const p1 = polar(0, 0, r, a1);
  const p2 = polar(0, 0, r, a2);
  return `M 0 0 L ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} Z`;
}
