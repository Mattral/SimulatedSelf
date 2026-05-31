/**
 * useFacialEmotion
 * ---------------------------------------------------------------
 * Unified replacement for `useFaceExpression` (heuristic brightness
 * analysis) and `useFacialEmotionDetection` (face-api global tag).
 *
 * Internally delegates to `useEmotionAnalytics`, which runs the
 * @vladmandic/face-api model inside a Web Worker. We preserve the
 * legacy `FaceExpression` shape so existing UI (MoodDisplay) keeps
 * working without changes.
 * ---------------------------------------------------------------
 */
import { useMemo } from 'react';
import { useEmotionAnalytics } from './useEmotionAnalytics';

export interface FaceExpression {
  emotion: string;
  confidence: number;
  expressions: {
    happy: number;
    sad: number;
    angry: number;
    surprised: number;
    neutral: number;
    fearful: number;
    disgusted: number;
  };
}

const EMPTY = {
  happy: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  neutral: 0,
  fearful: 0,
  disgusted: 0,
};

export const useFacialEmotion = () => {
  const {
    isActive,
    currentEmotion,
    confidence,
    expressions,
    isModelLoading,
    error,
    startDetection,
    stopDetection,
  } = useEmotionAnalytics();

  const currentExpression: FaceExpression | null = useMemo(() => {
    if (!isActive) return null;
    return {
      emotion: currentEmotion,
      confidence,
      expressions: { ...EMPTY, ...expressions },
    };
  }, [isActive, currentEmotion, confidence, expressions]);

  return {
    currentExpression,
    isAnalyzing: isActive,
    isModelLoading,
    error,
    startAnalysis: startDetection,
    stopAnalysis: stopDetection,
  };
};
