/**
 * Hand-pose → 3D rotation calibration.
 *
 * Maps MediaPipe Hands landmarks (21 per hand) to a stable orientation
 * quaternion for driving a 3D avatar's wrist/palm bone.
 *
 *   Landmarks used (MediaPipe Hands index):
 *     0  WRIST
 *     5  INDEX_MCP    (base of index finger)
 *     17 PINKY_MCP    (base of pinky)
 *
 * Construction:
 *   x_axis = normalize(pinky_mcp - index_mcp)      // across the palm
 *   y_axis = normalize((index_mcp + pinky_mcp)/2 - wrist)  // along forearm
 *   z_axis = normalize(cross(x_axis, y_axis))      // palm normal
 *   re-orthogonalise x_axis = cross(y_axis, z_axis)
 *
 *   Build a 3x3 rotation matrix from those columns → quaternion.
 *
 * Handedness:
 *   MediaPipe reports "Left"/"Right" but the labels are *mirror-flipped*
 *   when the camera feed is a selfie (most webcams are). We negate the
 *   palm normal for the right hand so both hands share the same chirality
 *   relative to the avatar.
 *
 * Calibration:
 *   Users sample a neutral rest pose (palms forward, fingers up). We
 *   record the resulting quaternion as `restInverse`; every subsequent
 *   sample is multiplied by `restInverse` so the avatar starts at
 *   identity in the user's natural posture. This removes per-user
 *   camera-angle bias.
 *
 * Drift handling:
 *   - One-Euro filter on the output quaternion (low cutoff at rest,
 *     higher cutoff during fast motion) to remove jitter without adding
 *     latency.
 *   - Confidence gate: if any of the 3 anchor landmarks has visibility
 *     < MIN_VIS, we skip the update and decay toward the last good
 *     orientation instead of snapping.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }
export interface Landmark { x: number; y: number; z: number; visibility?: number }

const MIN_VIS = 0.5;
const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

// ---------- tiny vec/quat helpers (no THREE dep here) ----------
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1e-9;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Build quaternion from an orthonormal basis (columns = x,y,z axes). */
function basisToQuat(x: Vec3, y: Vec3, z: Vec3): Quat {
  // Shepperd's method — numerically stable.
  const m00 = x.x, m01 = y.x, m02 = z.x;
  const m10 = x.y, m11 = y.y, m12 = z.y;
  const m20 = x.z, m21 = y.z, m22 = z.z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}

const qDot = (a: Quat, b: Quat) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
const qNeg = (a: Quat): Quat => ({ x: -a.x, y: -a.y, z: -a.z, w: -a.w });
const qNorm = (a: Quat): Quat => {
  const l = Math.hypot(a.x, a.y, a.z, a.w) || 1e-9;
  return { x: a.x / l, y: a.y / l, z: a.z / l, w: a.w / l };
};
const qConj = (a: Quat): Quat => ({ x: -a.x, y: -a.y, z: -a.z, w: a.w });
const qMul = (a: Quat, b: Quat): Quat => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});

/** Shortest-path slerp; flips sign when dot < 0 to avoid the long way. */
function slerp(a: Quat, b: Quat, t: number): Quat {
  let bb = b;
  let d = qDot(a, b);
  if (d < 0) { bb = qNeg(b); d = -d; }
  if (d > 0.9995) return qNorm({
    x: a.x + (bb.x - a.x) * t,
    y: a.y + (bb.y - a.y) * t,
    z: a.z + (bb.z - a.z) * t,
    w: a.w + (bb.w - a.w) * t,
  });
  const theta = Math.acos(d);
  const s1 = Math.sin((1 - t) * theta) / Math.sin(theta);
  const s2 = Math.sin(t * theta) / Math.sin(theta);
  return {
    x: s1 * a.x + s2 * bb.x,
    y: s1 * a.y + s2 * bb.y,
    z: s1 * a.z + s2 * bb.z,
    w: s1 * a.w + s2 * bb.w,
  };
}

/**
 * One-Euro filter tuned for quaternions.
 *  Higher derivative magnitude → cutoff opens up → less lag during motion.
 *  At rest → cutoff stays low → jitter suppressed.
 */
class OneEuroQuat {
  private prev: Quat | null = null;
  private prevTs = 0;
  private dCutoff = 1.0;
  constructor(private minCutoff = 1.0, private beta = 0.7) {}

  filter(q: Quat, tsMs: number): Quat {
    if (!this.prev) { this.prev = q; this.prevTs = tsMs; return q; }
    const dt = Math.max(1e-3, (tsMs - this.prevTs) / 1000);
    // angular distance between prev and current → derivative magnitude
    const d = Math.min(1, Math.abs(qDot(this.prev, q)));
    const speed = Math.acos(d) / dt; // rad / s
    const cutoff = this.minCutoff + this.beta * speed;
    const tau = 1 / (2 * Math.PI * cutoff);
    const alpha = 1 / (1 + tau / dt);
    const out = qNorm(slerp(this.prev, q, alpha));
    this.prev = out;
    this.prevTs = tsMs;
    void this.dCutoff; // reserved for future tuning
    return out;
  }

  reset() { this.prev = null; }
}

export type Handedness = 'Left' | 'Right';

/** Compute palm orientation quaternion from 21 hand landmarks. */
export function palmQuaternion(lm: Landmark[], handedness: Handedness): Quat | null {
  if (!lm || lm.length < 18) return null;
  const wrist = lm[0], indexMcp = lm[5], pinkyMcp = lm[17];
  const minVis = Math.min(
    wrist.visibility ?? 1,
    indexMcp.visibility ?? 1,
    pinkyMcp.visibility ?? 1,
  );
  if (minVis < MIN_VIS) return null;

  // MediaPipe Hands gives "Left"/"Right" from the *camera's* view.
  // Selfie cameras mirror the user, so the labels are swapped relative
  // to the avatar's anatomical side. Flip the palm-across axis for the
  // right hand to align chirality with the left.
  const acrossRaw = sub(pinkyMcp, indexMcp);
  const acrossPalm = handedness === 'Right' ? scale(acrossRaw, -1) : acrossRaw;

  const palmMid = scale(add(indexMcp, pinkyMcp), 0.5);
  const alongForearm = sub(palmMid, wrist);

  let x = norm(acrossPalm);
  const y = norm(alongForearm);
  let z = norm(cross(x, y));            // palm-normal (out of palm)
  if (handedness === 'Right') z = scale(z, -1);
  x = norm(cross(y, z));                // re-orthogonalise

  // sanity: degenerate basis → bail
  if (!isFinite(x.x + y.x + z.x)) return null;

  return qNorm(basisToQuat(x, y, z));
}

export interface CalibratorOptions {
  /** Frames required to lock a calibration. Default 30 (≈1s at 30fps). */
  sampleFrames?: number;
  /** One-Euro min cutoff (Hz). Lower = smoother but laggier. */
  minCutoff?: number;
  /** One-Euro beta. Higher = faster reaction during motion. */
  beta?: number;
}

export interface CalibrationStatus {
  calibrated: boolean;
  samplesCollected: number;
  samplesRequired: number;
  /** True when the last `update()` returned the cached last-good orientation
   *  because the current frame was missing/low-confidence (drift fallback). */
  usingLastGood: boolean;
  /** Monotonic counter of One-Euro filter fallbacks (no prev sample). */
  filterFallbackCount: number;
  /** Monotonic counter of pose dropouts (frame with no usable raw quat). */
  dropoutCount: number;
  /** Monotonic counter of cancelled / incomplete calibration attempts. */
  failureCount: number;
}


/**
 * Per-hand calibration + smoothing pipeline.
 *
 *   const cal = new HandCalibrator();
 *   cal.beginCalibration('Right');
 *   // ... feed frames via cal.update(...) until status.calibrated === true
 *   const q = cal.update(landmarks, 'Right', performance.now());
 */
export class HandCalibrator {
  private restInverse: Record<Handedness, Quat> = { Left: IDENTITY, Right: IDENTITY };
  private calibrated: Record<Handedness, boolean> = { Left: false, Right: false };
  private samples: Record<Handedness, Quat[]> = { Left: [], Right: [] };
  private collecting: Handedness | null = null;
  private filters: Record<Handedness, OneEuroQuat>;
  private lastGood: Record<Handedness, Quat> = { Left: IDENTITY, Right: IDENTITY };
  private readonly sampleFrames: number;

  constructor(opts: CalibratorOptions = {}) {
    this.sampleFrames = opts.sampleFrames ?? 30;
    this.filters = {
      Left: new OneEuroQuat(opts.minCutoff ?? 1.0, opts.beta ?? 0.7),
      Right: new OneEuroQuat(opts.minCutoff ?? 1.0, opts.beta ?? 0.7),
    };
  }

  beginCalibration(hand: Handedness) {
    this.collecting = hand;
    this.samples[hand] = [];
    this.calibrated[hand] = false;
    this.filters[hand].reset();
  }

  cancelCalibration() { this.collecting = null; }

  status(hand: Handedness): CalibrationStatus {
    return {
      calibrated: this.calibrated[hand],
      samplesCollected: this.samples[hand].length,
      samplesRequired: this.sampleFrames,
    };
  }

  reset(hand?: Handedness) {
    const hands: Handedness[] = hand ? [hand] : ['Left', 'Right'];
    for (const h of hands) {
      this.restInverse[h] = IDENTITY;
      this.calibrated[h] = false;
      this.samples[h] = [];
      this.filters[h].reset();
      this.lastGood[h] = IDENTITY;
    }
  }

  /**
   * Feed a frame of landmarks. Returns the avatar-space quaternion
   * (calibration-corrected, smoothed) or `null` when the hand isn't
   * visible enough to trust this frame.
   */
  update(lm: Landmark[] | null | undefined, hand: Handedness, tsMs: number): Quat | null {
    if (!lm) {
      // Decay toward last good orientation rather than snapping.
      return this.lastGood[hand];
    }
    const raw = palmQuaternion(lm, hand);
    if (!raw) return this.lastGood[hand];

    // Sample collection mid-calibration: average via iterative slerp
    // toward the running mean (avoids the sign-ambiguity of naive mean).
    if (this.collecting === hand && !this.calibrated[hand]) {
      this.samples[hand].push(raw);
      if (this.samples[hand].length >= this.sampleFrames) {
        let mean = this.samples[hand][0];
        for (let i = 1; i < this.samples[hand].length; i++) {
          mean = qNorm(slerp(mean, this.samples[hand][i], 1 / (i + 1)));
        }
        this.restInverse[hand] = qConj(mean);
        this.calibrated[hand] = true;
        this.collecting = null;
      }
    }

    // Calibration offset: rotate raw into rest-frame.
    const corrected = this.calibrated[hand] ? qMul(this.restInverse[hand], raw) : raw;
    const filtered = this.filters[hand].filter(corrected, tsMs);
    this.lastGood[hand] = filtered;
    return filtered;
  }
}

// Re-exports for tests / non-class callers
export const _internals = { palmQuaternion, slerp, basisToQuat, OneEuroQuat };
