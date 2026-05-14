import { useState, useRef, useCallback, useEffect } from 'react';

interface EmotionScores {
  happy: number;
  sad: number;
  angry: number;
  surprised: number;
  neutral: number;
}

interface DetectionResult {
  emotion: string;
  confidence: number;
  scores: EmotionScores;
}

export const useFacialEmotionDetection = () => {
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [emotionConfidence, setEmotionConfidence] = useState<number>(0);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emotionHistoryRef = useRef<string[]>([]);
  const isModelsLoadedRef = useRef(false);

  // Load face-api.js models
  const loadModels = useCallback(async () => {
    if (isModelsLoadedRef.current) return true;
    
    setIsModelLoading(true);
    setError(null);
    
    try {
      console.log('Loading face-api.js models...');
      
      // Load required models from CDN
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        window.faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        window.faceapi.nets.faceExpressionNet.loadFromUri('/models')
      ]);
      
      console.log('Face-api.js models loaded successfully');
      isModelsLoadedRef.current = true;
      setIsModelLoading(false);
      return true;
      
    } catch (err) {
      console.error('Error loading face-api.js models:', err);
      setError('Failed to load emotion detection models');
      setIsModelLoading(false);
      return false;
    }
  }, []);

  // Smooth emotion prediction using temporal filtering
  const smoothEmotionPrediction = useCallback((newEmotion: string) => {
    const history = emotionHistoryRef.current;
    history.push(newEmotion);
    
    // Keep only last 5 predictions for smoothing
    if (history.length > 5) {
      history.shift();
    }
    
    // Find most frequent emotion in recent history
    const emotionCounts: { [key: string]: number } = {};
    history.forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    
    let dominantEmotion = 'neutral';
    let maxCount = 0;
    
    Object.entries(emotionCounts).forEach(([emotion, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    });
    
    return dominantEmotion;
  }, []);

  // Detect emotion from video frame
  const detectEmotion = useCallback(async (videoElement: HTMLVideoElement): Promise<DetectionResult | null> => {
    if (!window.faceapi || !isModelsLoadedRef.current) {
      return null;
    }
    
    try {
      const detections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();
      
      if (detections.length > 0) {
        const expressions = detections[0].expressions;
        
        // Map face-api.js expressions to our emotion categories
        const scores: EmotionScores = {
          happy: expressions.happy || 0,
          sad: expressions.sad || 0,
          angry: expressions.angry || 0,
          surprised: expressions.surprised || 0,
          neutral: expressions.neutral || 0
        };
        
        // Find dominant emotion
        let dominantEmotion = 'neutral';
        let maxScore = 0;
        
        Object.entries(scores).forEach(([emotion, score]) => {
          if (score > maxScore) {
            maxScore = score;
            dominantEmotion = emotion;
          }
        });
        
        return {
          emotion: dominantEmotion,
          confidence: maxScore,
          scores
        };
      }
      
      return null;
      
    } catch (err) {
      console.error('Error detecting emotion:', err);
      return null;
    }
  }, []);

  // Start emotion detection
  const startDetection = useCallback(async (videoElement: HTMLVideoElement) => {
    console.log('Starting facial emotion detection...');
    
    const modelsLoaded = await loadModels();
    if (!modelsLoaded) {
      return;
    }
    
    setIsDetectionActive(true);
    setError(null);
    
    // Clear previous interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Start emotion detection every 750ms
    detectionIntervalRef.current = setInterval(async () => {
      if (videoElement && videoElement.readyState === 4) {
        const result = await detectEmotion(videoElement);
        
        if (result && result.confidence > 0.3) { // Minimum confidence threshold
          const smoothedEmotion = smoothEmotionPrediction(result.emotion);
          
          // Only update if emotion changed or confidence is high
          if (smoothedEmotion !== currentEmotion || result.confidence > 0.7) {
            console.log(`Emotion detected: ${smoothedEmotion} (confidence: ${result.confidence.toFixed(2)})`);
            setCurrentEmotion(smoothedEmotion);
            setEmotionConfidence(result.confidence);
          }
        }
      }
    }, 750);
    
  }, [loadModels, detectEmotion, smoothEmotionPrediction, currentEmotion]);

  // Stop emotion detection
  const stopDetection = useCallback(() => {
    console.log('Stopping facial emotion detection...');
    
    setIsDetectionActive(false);
    setCurrentEmotion('neutral');
    setEmotionConfidence(0);
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Clear emotion history
    emotionHistoryRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isDetectionActive,
    currentEmotion,
    emotionConfidence,
    isModelLoading,
    error,
    startDetection,
    stopDetection
  };
};

// Declare global face-api.js
declare global {
  interface Window {
    faceapi: any;
  }
}
