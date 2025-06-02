
import { useMediaPipePoseDetection } from './useMediaPipePoseDetection';

// Re-export the MediaPipe implementation
export const usePoseDetection = useMediaPipePoseDetection;

// Re-export types
export type { Landmark, PoseResults } from './useMediaPipePoseDetection';
