import * as THREE from 'three';

/**
 * View mode for the humanoid avatar.
 *
 * - `mirror` — the robot faces the camera and mirrors the user (default).
 * - `direct` — the robot faces away, so it moves like a shadow puppet of the
 *   user (raising your right arm raises the arm on your right of the screen).
 */
export type ViewMode = 'mirror' | 'direct';

/**
 * Single source of truth for landmark → world-space conversion.
 *
 * The view mode is baked into the *coordinate transform* rather than applied
 * as a 180° rotation of the parent group. This matters because limb
 * orientation (upper-arm / forearm / thigh / shin) is derived every frame from
 * the transformed endpoints via `lookAt`. Rotating the group instead would
 * leave the derived orientation computed in the un-rotated space, which is
 * exactly what made Direct-mode arm placement look broken whenever the
 * Iron-Man meshes were missing and the fallback capsules were used.
 *
 * `direct` is the 180°-about-Y image of `mirror`: X and Z negate, Y is
 * unchanged.
 */
export function landmarkToWorld(
  landmark: { x: number; y: number; z: number },
  mode: ViewMode = 'mirror',
): THREE.Vector3 {
  const s = mode === 'direct' ? -1 : 1;
  return new THREE.Vector3(
    -s * (landmark.x - 0.5) * 4,
    -(landmark.y - 0.5) * 3,
    -s * landmark.z * 2,
  );
}
