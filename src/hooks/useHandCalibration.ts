/**
 * Thin React wrapper around HandCalibrator.
 * Holds the calibrator across renders and surfaces start/reset controls
 * + per-hand calibration status.
 */
import { useCallback, useRef, useState } from 'react';
import { HandCalibrator, type Handedness, type Quat, type Landmark, type CalibrationStatus } from '@/lib/handCalibration';

export interface UseHandCalibrationApi {
  /** Feed landmarks every frame. Returns corrected+smoothed quaternion. */
  update: (lm: Landmark[] | null | undefined, hand: Handedness, tsMs?: number) => Quat | null;
  beginCalibration: (hand: Handedness) => void;
  resetCalibration: (hand?: Handedness) => void;
  status: { Left: CalibrationStatus; Right: CalibrationStatus };
}

export function useHandCalibration(): UseHandCalibrationApi {
  const ref = useRef<HandCalibrator | null>(null);
  if (!ref.current) ref.current = new HandCalibrator();

  const emptyStatus: CalibrationStatus = {
    calibrated: false,
    samplesCollected: 0,
    samplesRequired: 30,
    usingLastGood: false,
    filterFallbackCount: 0,
    dropoutCount: 0,
    failureCount: 0,
  };
  const [status, setStatus] = useState<{ Left: CalibrationStatus; Right: CalibrationStatus }>({
    Left: emptyStatus,
    Right: emptyStatus,
  });


  const refreshStatus = useCallback(() => {
    const c = ref.current!;
    setStatus({ Left: c.status('Left'), Right: c.status('Right') });
  }, []);

  const lastSig = useRef('');
  const update = useCallback((lm: Landmark[] | null | undefined, hand: Handedness, tsMs = performance.now()) => {
    const q = ref.current!.update(lm, hand, tsMs);
    const s = ref.current!.status(hand);
    // Cheap signature; only re-render when something visible changed.
    const sig = `${hand}:${s.calibrated}:${s.samplesCollected}:${s.usingLastGood}:${s.dropoutCount}:${s.filterFallbackCount}`;
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      refreshStatus();
    }
    return q;
  }, [refreshStatus]);



  const beginCalibration = useCallback((hand: Handedness) => {
    ref.current!.beginCalibration(hand);
    refreshStatus();
  }, [refreshStatus]);

  const resetCalibration = useCallback((hand?: Handedness) => {
    ref.current!.reset(hand);
    refreshStatus();
  }, [refreshStatus]);

  return { update, beginCalibration, resetCalibration, status };
}
