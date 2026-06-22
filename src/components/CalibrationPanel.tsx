/**
 * CalibrationPanel
 * -----------------------------------------------------------------
 * Live diagnostics for the hand-pose calibration pipeline.
 * Renders:
 *   - per-hand calibration progress bar (samples collected / required)
 *   - detected handedness chips (Left / Right) with "active" highlight
 *   - drift filter state: "live" vs "holding last-good orientation"
 *   - rolling counters: One-Euro fallback usage, pose dropouts, failures
 *
 * Purely presentational: consumes `status` from `useHandCalibration()`
 * via props so it can be unit-tested without React context.
 *
 * Tailwind tokens only — no hard-coded colours, so it inherits theme.
 */
import React from 'react';
import type { CalibrationStatus, Handedness } from '@/lib/handCalibration';

export interface CalibrationPanelProps {
  status: Record<Handedness, CalibrationStatus>;
  /** Currently-detected handedness from the pose pipeline, if any. */
  activeHand?: Handedness | null;
  onBeginCalibration?: (hand: Handedness) => void;
  onReset?: (hand?: Handedness) => void;
  className?: string;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function HandCard({
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
  const stateLabel = s.calibrated
    ? s.usingLastGood
      ? 'Holding last-good'
      : 'Live'
    : collecting
      ? 'Calibrating…'
      : 'Idle';
  const stateTone = s.calibrated
    ? s.usingLastGood
      ? 'text-amber-500'
      : 'text-emerald-500'
    : collecting
      ? 'text-sky-500'
      : 'text-muted-foreground';

  return (
    <div
      className={[
        'rounded-md border bg-card/60 backdrop-blur-sm p-3 text-card-foreground',
        active ? 'ring-2 ring-primary/60' : 'opacity-90',
      ].join(' ')}
      data-testid={`calibration-${hand.toLowerCase()}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider">{hand}</span>
          {active && (
            <span className="text-[10px] rounded-full bg-primary/20 text-primary px-1.5 py-0.5">
              detected
            </span>
          )}
        </div>
        <span className={['text-[11px] font-medium', stateTone].join(' ')}>{stateLabel}</span>
      </div>

      <Bar value={s.samplesCollected} max={s.samplesRequired} />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{s.samplesCollected}/{s.samplesRequired} samples</span>
        <span>
          drift fb: {s.filterFallbackCount} · drop: {s.dropoutCount}
          {s.failureCount > 0 ? ` · fail: ${s.failureCount}` : ''}
        </span>
      </div>

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={onBegin}
          className="flex-1 text-[11px] rounded border border-border bg-background/60 hover:bg-accent hover:text-accent-foreground px-2 py-1"
        >
          {s.calibrated ? 'Recalibrate' : 'Calibrate'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] rounded border border-border bg-background/60 hover:bg-destructive hover:text-destructive-foreground px-2 py-1"
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
  onBeginCalibration,
  onReset,
  className,
}) => {
  return (
    <section
      aria-label="Hand calibration diagnostics"
      className={['w-64 space-y-2 p-2 rounded-lg border bg-background/70 backdrop-blur', className].filter(Boolean).join(' ')}
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          Hand Calibration
        </h2>
        <button
          type="button"
          onClick={() => onReset?.()}
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          reset all
        </button>
      </header>
      <HandCard
        hand="Left"
        s={status.Left}
        active={activeHand === 'Left'}
        onBegin={() => onBeginCalibration?.('Left')}
        onReset={() => onReset?.('Left')}
      />
      <HandCard
        hand="Right"
        s={status.Right}
        active={activeHand === 'Right'}
        onBegin={() => onBeginCalibration?.('Right')}
        onReset={() => onReset?.('Right')}
      />
    </section>
  );
};

export default CalibrationPanel;
