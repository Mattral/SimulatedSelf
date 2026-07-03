import React from 'react';

interface Landmark { x: number; y: number; z: number; visibility?: number }

interface PalmOverlayProps {
  leftHand: Landmark[] | null | undefined;
  rightHand: Landmark[] | null | undefined;
  viewMode: 'mirror' | 'direct';
}

/**
 * PalmOverlay
 * ----------------------------------------------------------------
 * On-screen HUD that labels the detected left/right palms and
 * shows a live depth (Z) indicator for each. Also surfaces the
 * active view mode (Mirror / Direct) so the user always knows
 * which handedness convention is in effect.
 *
 * Depth is read directly from `hand[0].z` — the wrist landmark
 * emitted by MediaPipe. Negative Z = closer to the camera, positive
 * Z = further away. We clamp to [-0.3, 0.3] for the bar since that
 * covers the useful arm-length range at typical laptop distances.
 * ----------------------------------------------------------------
 */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const DepthBar: React.FC<{ z: number | null; label: string; accent: string }> = ({ z, label, accent }) => {
  const value = z ?? 0;
  // Normalise -0.3..0.3 → 0..1 for the indicator dot.
  const norm = clamp((value + 0.3) / 0.6, 0, 1);
  const detected = z !== null;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-16 text-xs font-medium ${detected ? accent : 'text-white/40'}`}>
        {label}
      </span>
      <div className="relative h-1.5 w-28 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`absolute top-0 h-full w-1.5 rounded-full transition-all duration-150 ${
            detected ? accent.replace('text-', 'bg-') : 'bg-white/20'
          }`}
          style={{ left: `calc(${norm * 100}% - 3px)` }}
        />
        {/* Camera plane marker (z=0) */}
        <div className="absolute top-0 left-1/2 h-full w-px bg-white/30" />
      </div>
      <span className={`w-14 text-right text-[10px] tabular-nums ${detected ? 'text-white/80' : 'text-white/30'}`}>
        {detected ? `z ${value >= 0 ? '+' : ''}${value.toFixed(2)}` : '—'}
      </span>
    </div>
  );
};

const PalmOverlay: React.FC<PalmOverlayProps> = ({ leftHand, rightHand, viewMode }) => {
  const lz = leftHand && leftHand[0] ? leftHand[0].z : null;
  const rz = rightHand && rightHand[0] ? rightHand[0].z : null;

  return (
    <div className="pointer-events-none select-none rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-2 shadow-lg text-white">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/60">Palms</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            viewMode === 'mirror'
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
              : 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'
          }`}
          aria-label={`View mode ${viewMode}`}
        >
          {viewMode === 'mirror' ? '🪞 Mirror' : '👤 Direct'}
        </span>
      </div>
      <div className="space-y-1">
        <DepthBar z={lz} label="🖐 Left" accent="text-rose-300" />
        <DepthBar z={rz} label="🖐 Right" accent="text-sky-300" />
      </div>
      <p className="mt-1.5 text-[9px] text-white/40 leading-tight">
        Bar left = closer · right = further · line = camera plane
      </p>
    </div>
  );
};

export default PalmOverlay;
