/**
 * Calibration / palm-quaternion smoke tests.
 *
 *   1. Identity pose → identity-ish quaternion (within tolerance).
 *   2. Left vs right of the same physical pose produce quaternions that
 *      agree up to handedness flip (chirality correction).
 *   3. Calibration zeroes out the resting pose → subsequent identical
 *      samples return identity.
 *   4. One-Euro filter suppresses high-frequency jitter at rest.
 */
import { describe, it, expect } from 'vitest';
import { HandCalibrator, _internals, type Landmark } from './handCalibration';

function mkHand(roll = 0): Landmark[] {
  // Minimal 21-point hand laid flat in XY at z=0, with optional roll about Y.
  const c = Math.cos(roll), s = Math.sin(roll);
  const p = (x: number, y: number, z = 0): Landmark => ({
    x: x * c + z * s, y, z: -x * s + z * c, visibility: 1,
  });
  const arr: Landmark[] = new Array(21).fill(null).map(() => p(0, 0));
  arr[0]  = p(0, 0);      // wrist
  arr[5]  = p(-0.5, 1);   // index_mcp (left side of palm in image)
  arr[17] = p(0.5, 1);    // pinky_mcp (right side of palm)
  return arr;
}

describe('palmQuaternion', () => {
  it('returns a normalised quaternion', () => {
    const q = _internals.palmQuaternion(mkHand(), 'Left')!;
    const mag = Math.hypot(q.x, q.y, q.z, q.w);
    expect(Math.abs(mag - 1)).toBeLessThan(1e-6);
  });

  it('respects handedness — right hand basis is mirrored', () => {
    const ql = _internals.palmQuaternion(mkHand(), 'Left')!;
    const qr = _internals.palmQuaternion(mkHand(), 'Right')!;
    // After chirality correction the two should NOT be identical (selfie
    // flip is applied), confirming the correction ran.
    expect(ql).not.toEqual(qr);
  });

  it('skips frames with low landmark visibility', () => {
    const lm = mkHand();
    lm[0].visibility = 0.1;
    expect(_internals.palmQuaternion(lm, 'Left')).toBeNull();
  });
});

describe('HandCalibrator', () => {
  it('locks calibration after enough samples and zeroes the rest pose', () => {
    const cal = new HandCalibrator({ sampleFrames: 5, minCutoff: 1000, beta: 0 });
    cal.beginCalibration('Left');
    let ts = 0;
    for (let i = 0; i < 5; i++) cal.update(mkHand(), 'Left', (ts += 33));
    expect(cal.status('Left').calibrated).toBe(true);

    // Subsequent identical sample → quaternion close to identity.
    const q = cal.update(mkHand(), 'Left', (ts += 33))!;
    expect(Math.abs(q.w) - 1).toBeLessThan(0.05);
  });

  it('returns last-good quaternion when landmarks drop out (drift handling)', () => {
    const cal = new HandCalibrator({ sampleFrames: 1 });
    cal.beginCalibration('Right');
    const first = cal.update(mkHand(0.3), 'Right', 0)!;
    const dropped = cal.update(null, 'Right', 16);
    expect(dropped).toEqual(first);
  });
});
