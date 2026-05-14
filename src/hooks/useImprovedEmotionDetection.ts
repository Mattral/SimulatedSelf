import { useState, useRef, useCallback, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';

export interface ImprovedEmotionData {
  emotion: string;
  confidence: number;
  expressions: Record<string, number>;
  timestamp: number;
}

export const useImprovedEmotionDetection = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [confidence, setConfidence] = useState<number>(0);
  const [expressions, setExpressions] = useState<Record<string, number>>({});
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isModelsLoadedRef = useRef(false);
  const emotionHistoryRef = useRef<ImprovedEmotionData[]>([]);

  const loadModels = useCallback(async () => {
    if (isModelsLoadedRef.current) return true;
    
    setIsModelLoading(true);
    setError(null);
    
    try {
      console.log('Loading @vladmandic/face-api models...');
      
      // Try loading from public models directory first
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceExpressionNet.loadFromUri('/models');
      
      console.log('Models loaded from local directory');
      isModelsLoadedRef.current = true;
      setIsModelLoading(false);
      return true;
      
    } catch (error) {
      console.log('Local models not found, trying CDN...');
      
      try {
        // Fallback to CDN
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
        await faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
        
        console.log('Models loaded from CDN');
        isModelsLoadedRef.current = true;
        setIsModelLoading(false);
        return true;
        
      } catch (cdnError) {
        console.error('Failed to load models from CDN:', cdnError);
        setError('Could not load emotion detection models. Please check your internet connection.');
        setIsModelLoading(false);
        return false;
      }
    }
  }, []);

  const detectEmotions = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!videoElement || !isModelsLoadedRef.current || videoElement.readyState !== 4) {
      return null;
    }

    try {
      const detections = await faceapi
        .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.5
        }))
        .withFaceExpressions();

      if (detections && detections.length > 0) {
        const expressions = detections[0].expressions;
        
        // Convert expressions to our format
        const expressionData = {
          happy: expressions.happy || 0,
          sad: expressions.sad || 0,
          angry: expressions.angry || 0,
          surprised: expressions.surprised || 0,
          neutral: expressions.neutral || 0,
          fearful: expressions.fearful || 0,
          disgusted: expressions.disgusted || 0
        };

        // Find dominant emotion
        const emotionEntries = Object.entries(expressionData);
        const dominantEmotion = emotionEntries.reduce((prev, current) => 
          prev[1] > current[1] ? prev : current
        );
        
        const emotionName = dominantEmotion[0];
        const emotionConfidence = dominantEmotion[1];

        return {
          emotion: emotionName,
          confidence: emotionConfidence,
          expressions: expressionData,
          timestamp: Date.now()
        };
      }
      
      return null;
      
    } catch (err) {
      console.error('Error in emotion detection:', err);
      return null;
    }
  }, []);

  const updateEmotionWithSmoothing = useCallback((newEmotion: ImprovedEmotionData) => {
    const history = emotionHistoryRef.current;
    history.push(newEmotion);
    
    // Keep only last 6 predictions for smoothing
    if (history.length > 6) {
      history.shift();
    }
    
    // Remove old predictions (older than 2.5 seconds)
    const now = Date.now();
    emotionHistoryRef.current = history.filter(
      emotion => now - emotion.timestamp < 2500
    );
    
    // Calculate smoothed emotion
    const recentHistory = emotionHistoryRef.current;
    if (recentHistory.length === 0) return;
    
    const emotionCounts: { [key: string]: { count: number; totalConfidence: number } } = {};
    
    recentHistory.forEach(emotion => {
      if (!emotionCounts[emotion.emotion]) {
        emotionCounts[emotion.emotion] = { count: 0, totalConfidence: 0 };
      }
      emotionCounts[emotion.emotion].count++;
      emotionCounts[emotion.emotion].totalConfidence += emotion.confidence;
    });
    
    // Find most confident emotion
    let bestEmotion = 'neutral';
    let bestScore = 0;
    
    Object.entries(emotionCounts).forEach(([emotion, data]) => {
      const avgConfidence = data.totalConfidence / data.count;
      const score = data.count * avgConfidence;
      
      if (score > bestScore) {
        bestScore = score;
        bestEmotion = emotion;
      }
    });
    
    const avgConfidence = emotionCounts[bestEmotion]?.totalConfidence / emotionCounts[bestEmotion]?.count || 0;
    
    // Only update if significant change or high confidence
    if (bestEmotion !== currentEmotion || avgConfidence > 0.6) {
      console.log(`Improved emotion detected: ${bestEmotion} (confidence: ${avgConfidence.toFixed(2)})`);
      setCurrentEmotion(bestEmotion);
      setConfidence(avgConfidence);
      setExpressions(newEmotion.expressions);
    }
  }, [currentEmotion]);

  const startDetection = useCallback(async (videoElement: HTMLVideoElement) => {
    console.log('Starting improved emotion detection...');
    
    const modelsLoaded = await loadModels();
    if (!modelsLoaded) return;
    
    setIsActive(true);
    setError(null);
    
    // Clear previous interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Start detection with optimized interval
    detectionIntervalRef.current = setInterval(async () => {
      if (videoElement && videoElement.readyState === 4 && videoElement.videoWidth > 0) {
        const emotionData = await detectEmotions(videoElement);
        
        if (emotionData && emotionData.confidence > 0.3) {
          updateEmotionWithSmoothing(emotionData);
        }
      }
    }, 400); // Detect every 400ms for better performance
    
  }, [loadModels, detectEmotions, updateEmotionWithSmoothing]);

  const stopDetection = useCallback(() => {
    console.log('Stopping improved emotion detection...');
    
    setIsActive(false);
    setCurrentEmotion('neutral');
    setConfidence(0);
    setExpressions({});
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Clear emotion history
    emotionHistoryRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isActive,
    currentEmotion,
    confidence,
    expressions,
    isModelLoading,
    error,
    startDetection,
    stopDetection
  };
};
