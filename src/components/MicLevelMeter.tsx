import React from 'react';
import { useMicLevel } from '../hooks/useMicLevel';

interface MicLevelMeterProps {
  /** When true, the hook opens the mic and the meter animates. */
  active: boolean;
  /** Optional class to position the meter container. */
  className?: string;
}

const BAR_COUNT = 18;

/**
 * MicLevelMeter — real-time input-level visualiser plus contextual tips.
 *
 * Lights bars based on RMS loudness, shows a sliding peak hairline, and
 * surfaces actionable guidance when the mic is silent, blocked, or errored.
 * The meter is only mounted while `active` is true to avoid holding the
 * microphone open during idle.
 */
export const MicLevelMeter: React.FC<MicLevelMeterProps> = ({ active, className }) => {
  const { level, peak, isSilent, error, permissionState } = useMicLevel(active);

  if (!active) return null;

  const lit = Math.round(level * BAR_COUNT);
  const peakIndex = Math.min(BAR_COUNT - 1, Math.round(peak * BAR_COUNT));

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 p-3 text-white shadow-inner backdrop-blur ${className ?? ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Microphone level ${Math.round(level * 100)} percent`}
    >
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/60">
        <span>Mic level</span>
        <span className="font-mono text-white/40">{Math.round(level * 100)}%</span>
      </div>

      <div className="flex h-6 items-end gap-[2px]">
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const isPeak = i === peakIndex && peak > 0.02;
          const filled = i < lit;
          // green → amber → red gradient based on bar index
          const colour =
            i < BAR_COUNT * 0.6
              ? 'bg-emerald-400'
              : i < BAR_COUNT * 0.85
                ? 'bg-amber-400'
                : 'bg-rose-500';
          const heightPct = 30 + (i / BAR_COUNT) * 70;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-sm transition-[opacity,transform] duration-75 ${
                filled ? `${colour} opacity-100` : 'bg-white/10 opacity-60'
              } ${isPeak ? 'ring-1 ring-white/80' : ''}`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>

      {/* Contextual guidance */}
      <div className="mt-2 text-[11px] leading-snug">
        {error ? (
          <p className="text-rose-200">{error}</p>
        ) : permissionState === 'denied' ? (
          <p className="text-rose-200">
            Microphone blocked. Click the 🔒 icon in your address bar → Site settings → allow Microphone, then reload.
          </p>
        ) : isSilent ? (
          <p className="text-white/70">
            I can't hear you. Speak closer to the mic, unmute your system input, or pick the right device in your OS sound settings.
          </p>
        ) : level > 0.92 ? (
          <p className="text-amber-200">A bit loud — try backing off the mic to reduce clipping.</p>
        ) : (
          <p className="text-emerald-200/90">Mic is live — you should be heard clearly.</p>
        )}
      </div>
    </div>
  );
};

export default MicLevelMeter;
