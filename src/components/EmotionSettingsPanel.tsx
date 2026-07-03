import React, { useState } from 'react';
import type { EmotionSettings } from '../hooks/useEmotionAnalytics';

interface Props {
  settings: EmotionSettings;
  onChange: (patch: Partial<EmotionSettings>) => void;
  onReset: () => void;
}

/**
 * EmotionSettingsPanel
 * ----------------------------------------------------------------
 * Live calibration panel for the face-api emotion pipeline.
 *
 *   - scoreThreshold: detector confidence cutoff. Lower ⇒ more
 *     candidate faces (helps in dim or side-lit rooms), higher ⇒
 *     fewer false positives.
 *   - inputSize: TinyFaceDetector resolution (multiples of 32).
 *     Larger ⇒ better recall at more CPU cost.
 *   - highConfidenceBypass: single-frame confidence at which the
 *     smoother is skipped so sharp expressions surface immediately.
 *   - historyWindowMs: how far back the sliding smoother looks.
 *   - sampleIntervalMs: how often the main thread ships a frame
 *     to the worker (≈ inverse of update rate).
 * ----------------------------------------------------------------
 */
const Row: React.FC<{ label: string; hint: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-3">
      <label className="text-xs font-medium text-white/90">{label}</label>
      <span className="text-[10px] text-white/50">{hint}</span>
    </div>
    {children}
  </div>
);

const EmotionSettingsPanel: React.FC<Props> = ({ settings, onChange, onReset }) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-black/70 hover:bg-black/90 text-white text-xs px-3 py-1.5 shadow-lg border border-white/10 backdrop-blur-md"
        title="Emotion detection settings"
      >
        ⚙️ Emotion
      </button>
    );
  }

  return (
    <div className="w-72 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl text-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">🎭 Emotion Calibration</div>
          <div className="text-[10px] text-white/50">Tune face-api for your lighting</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-white/60 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/10"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      <Row label="Detector score threshold" hint={settings.scoreThreshold.toFixed(2)}>
        <input
          type="range" min={0.1} max={0.9} step={0.05}
          value={settings.scoreThreshold}
          onChange={(e) => onChange({ scoreThreshold: parseFloat(e.target.value) })}
          className="w-full accent-purple-400"
        />
      </Row>

      <Row label="Input size" hint={`${settings.inputSize}px`}>
        <input
          type="range" min={160} max={512} step={32}
          value={settings.inputSize}
          onChange={(e) => onChange({ inputSize: parseInt(e.target.value, 10) })}
          className="w-full accent-purple-400"
        />
      </Row>

      <Row label="High-confidence bypass" hint={settings.highConfidenceBypass.toFixed(2)}>
        <input
          type="range" min={0.3} max={0.95} step={0.05}
          value={settings.highConfidenceBypass}
          onChange={(e) => onChange({ highConfidenceBypass: parseFloat(e.target.value) })}
          className="w-full accent-purple-400"
        />
      </Row>

      <Row label="Smoothing window" hint={`${settings.historyWindowMs} ms`}>
        <input
          type="range" min={200} max={4000} step={100}
          value={settings.historyWindowMs}
          onChange={(e) => onChange({ historyWindowMs: parseInt(e.target.value, 10) })}
          className="w-full accent-purple-400"
        />
      </Row>

      <Row label="Sample interval" hint={`${settings.sampleIntervalMs} ms`}>
        <input
          type="range" min={80} max={800} step={20}
          value={settings.sampleIntervalMs}
          onChange={(e) => onChange({ sampleIntervalMs: parseInt(e.target.value, 10) })}
          className="w-full accent-purple-400"
        />
      </Row>

      <div className="flex justify-end pt-1">
        <button
          onClick={onReset}
          className="text-[11px] px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80"
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
};

export default EmotionSettingsPanel;
