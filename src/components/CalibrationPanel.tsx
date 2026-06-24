/**
 * CalibrationPanel
 * -----------------------------------------------------------------
 * Compact, toggleable diagnostics for the hand-pose calibration
 * pipeline. Designed in the spirit of Apple's Control Center: a
 * single glass pill that expands into a focused, low-chrome panel.
 *
 * UX rules:
 *  - Collapsed by default; one tap toggles it.
 *  - Never overlaps page chrome on mobile (anchored bottom-right
 *    above the menu; top-left on md+).
 *  - Uses only semantic Tailwind tokens — no hard-coded colours.
 */
import React from 'react';
import type { CalibrationStatus, Handedness } from '@/lib/handCalibration';

export interface CalibrationPanelProps {
  status: Record<Handedness, CalibrationStatus>;
  activeHand?: Handedness | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeginCalibration?: (hand: Handedness) => void;
  onReset?: (hand?: Handedness) => void;
  className?: string;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full bg-white/80 transition-[width] duration-200 ease-out"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function StatusDot({ tone }: { tone: 'live' | 'hold' | 'calibrating' | 'idle' }) {
  const cls =
    tone === 'live'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
      : tone === 'hold'
        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
        : tone === 'calibrating'
          ? 'bg-sky-400 animate-pulse'
          : 'bg-white/30';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

function HandRow({
  hand,
  s,
  active,
  onBegin,
  onReset,
}: {
  hand: Handedness;
  s: CalibrationStatus;
  active: boolean;
  onBegin?: () => void;
  onReset?: () => void;
}) {
  const collecting = !s.calibrated && s.samplesCollected > 0;
  const tone: 'live' | 'hold' | 'calibrating' | 'idle' = s.calibrated
    ? s.usingLastGood ? 'hold' : 'live'
    : collecting ? 'calibrating' : 'idle';
  const stateLabel = tone === 'hold' ? 'Holding' : tone === 'live' ? 'Live' : tone === 'calibrating' ? 'Calibrating' : 'Idle';

  return (
    <div
      className={[
        'rounded-xl px-3 py-2.5 transition-colors',
        active ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/[0.04]',
      ].join(' ')}
      data-testid={`calibration-${hand.toLowerCase()}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot tone={tone} />
          <span className="text-[11px] font-medium tracking-wide text-white/90">{hand} hand</span>
          {active && (
            <span className="text-[9px] uppercase tracking-wider text-white/50">· detected</span>
          )}
        </div>
        <span className="text-[10px] text-white/60">{stateLabel}</span>
      </div>

      <Bar value={s.samplesCollected} max={s.samplesRequired} />

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45">
        <span>{s.samplesCollected}/{s.samplesRequired}</span>
        <span className="tabular-nums">
          fb {s.filterFallbackCount} · drop {s.dropoutCount}
          {s.failureCount > 0 ? ` · fail ${s.failureCount}` : ''}
        </span>
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={onBegin}
          className="flex-1 text-[10.5px] font-medium rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 text-white px-2 py-1.5 transition-colors"
        >
          {s.calibrated ? 'Recalibrate' : 'Calibrate'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-[10.5px] font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-2.5 py-1.5 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  status,
  activeHand,
  open,
  onOpenChange,
  onBeginCalibration,
  onReset,
  className,
}) => {
  // Compact summary dot for the trigger.
  const anyHolding = status.Left.usingLastGood || status.Right.usingLastGood;
  const anyCalibrating =
    (!status.Left.calibrated && status.Left.samplesCollected > 0) ||
    (!status.Right.calibrated && status.Right.samplesCollected > 0);
  const allCalibrated = status.Left.calibrated && status.Right.calibrated;
  const dotTone: 'live' | 'hold' | 'calibrating' | 'idle' = anyCalibrating
    ? 'calibrating'
    : anyHolding
      ? 'hold'
      : allCalibrated
        ? 'live'
        : 'idle';

  return (
    <div className={['pointer-events-auto', className].filter(Boolean).join(' ')}>
      {/* Trigger pill — always visible, very small footprint. */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="calibration-panel-body"
        className="group inline-flex items-center gap-2 rounded-full bg-black/55 hover:bg-black/65 backdrop-blur-xl ring-1 ring-white/10 px-3 py-1.5 text-[11px] font-medium text-white/90 shadow-lg transition-colors"
      >
        <StatusDot tone={dotTone} />
        <span>Calibration</span>
        <span className="text-white/40 text-[10px]" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {/* Body — collapses; on mobile it expands above the trigger. */}
      <div
        id="calibration-panel-body"
        hidden={!open}
        className="mt-2 w-[260px] max-w-[calc(100vw-2rem)] rounded-2xl bg-black/65 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl p-2.5 space-y-2"
        aria-label="Hand calibration diagnostics"
        role="region"
      >
        <div className="flex items-center justify-between px-1 pt-0.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">
            Hand Tracking
          </span>
          <button
            type="button"
            onClick={() => onReset?.()}
            className="text-[10px] text-white/45 hover:text-white/80 transition-colors"
          >
            reset all
          </button>
        </div>
        <HandRow
          hand="Left"
          s={status.Left}
          active={activeHand === 'Left'}
          onBegin={() => onBeginCalibration?.('Left')}
          onReset={() => onReset?.('Left')}
        />
        <HandRow
          hand="Right"
          s={status.Right}
          active={activeHand === 'Right'}
          onBegin={() => onBeginCalibration?.('Right')}
          onReset={() => onReset?.('Right')}
        />
      </div>
    </div>
  );
};

export default CalibrationPanel;
