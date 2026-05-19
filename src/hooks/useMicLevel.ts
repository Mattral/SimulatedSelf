import { useEffect, useRef, useState } from 'react';

/**
 * useMicLevel
 * -----------
 * Lightweight Web Audio meter that exposes a normalised microphone input level
 * (0..1) and a derived `isSilent` flag. Active only when `enabled` is true so
 * we do not hold the microphone open while the voice pipeline is idle.
 *
 * Implementation notes
 *   - Uses `getUserMedia({ audio: { echoCancellation, noiseSuppression,
 *     autoGainControl } })` so the meter reflects the same signal the
 *     SpeechRecognition engine receives in modern Chromium browsers.
 *   - Reads time-domain samples from an `AnalyserNode` and computes RMS,
 *     which correlates better with perceived loudness than peak amplitude.
 *   - Animation via `requestAnimationFrame`; cleans up the audio graph and
 *     media tracks on disable/unmount so the OS mic indicator turns off.
 */
export interface MicLevelState {
  level: number;          // 0..1 (RMS, smoothed)
  peak: number;           // 0..1 (sliding peak over ~1s)
  isSilent: boolean;      // true when level has stayed below threshold for >1.5s
  error: string | null;
  permissionState: 'unknown' | 'prompt' | 'granted' | 'denied';
}

const SILENCE_THRESHOLD = 0.015;
const SILENCE_WINDOW_MS = 1500;

export function useMicLevel(enabled: boolean): MicLevelState {
  const [state, setState] = useState<MicLevelState>({
    level: 0,
    peak: 0,
    isSilent: true,
    error: null,
    permissionState: 'unknown',
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastLoudAtRef = useRef<number>(Date.now());
  const peakRef = useRef<number>(0);
  const peakDecayAtRef = useRef<number>(Date.now());

  useEffect(() => {
    // Permission state (best-effort; not all browsers expose microphone).
    if ('permissions' in navigator) {
      (navigator.permissions.query?.({ name: 'microphone' as PermissionName }) as Promise<any> | undefined)
        .then((res: any) => {
          setState((s) => ({ ...s, permissionState: res.state }));
          res.onchange = () =>
            setState((s) => ({ ...s, permissionState: res.state }));
        })
        .catch(() => void 0);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const AudioCtor =
          window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AudioCtor();
        ctxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);

        const buf = new Float32Array(analyser.fftSize);

        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          // RMS over the window — robust to brief transients.
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
          const rms = Math.sqrt(sumSq / buf.length);
          // Soft-clip and gamma-correct to feel responsive in the UI.
          const level = Math.min(1, Math.pow(rms * 3.2, 0.85));

          const now = Date.now();
          if (level > peakRef.current) {
            peakRef.current = level;
            peakDecayAtRef.current = now;
          } else if (now - peakDecayAtRef.current > 60) {
            peakRef.current = Math.max(level, peakRef.current * 0.92);
            peakDecayAtRef.current = now;
          }

          if (level > SILENCE_THRESHOLD) lastLoudAtRef.current = now;
          const isSilent = now - lastLoudAtRef.current > SILENCE_WINDOW_MS;

          setState((s) =>
            s.level === level && s.peak === peakRef.current && s.isSilent === isSilent
              ? s
              : { ...s, level, peak: peakRef.current, isSilent },
          );
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err: any) {
        const denied =
          err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
        setState((s) => ({
          ...s,
          error: denied
            ? 'Microphone access was blocked. Allow it in your browser site settings.'
            : err?.message ?? 'Could not open the microphone.',
          permissionState: denied ? 'denied' : s.permissionState,
        }));
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ctxRef.current?.close().catch(() => void 0);
      ctxRef.current = null;
      setState((s) => ({ ...s, level: 0, peak: 0, isSilent: true }));
    };
  }, [enabled]);

  return state;
}
