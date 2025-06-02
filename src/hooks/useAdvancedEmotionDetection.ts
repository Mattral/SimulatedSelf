import { useState, useRef, useCallback, useEffect } from 'react';

interface EmotionData {
  emotion: string;
  confidence: number;
  timestamp: number;
}

interface EmotionScores {
  happy: number;
  sad: number;
  angry: number;
  surprised: number;
  neutral: number;
}

export const useAdvancedEmotionDetection = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [confidence, setConfidence] = useState<number>(0);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emotionHistoryRef = useRef<EmotionData[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isModelsLoadedRef = useRef(false);
  const lastDetectionRef = useRef<number>(0);

  // Initialize models with better error handling
  const initializeModels = useCallback(async () => {
    if (isModelsLoadedRef.current) return true;
    
    setIsModelLoading(true);
    setError(null);
    
    try {
      console.log('Loading advanced emotion detection models...');
      
      if (!window.faceapi) {
        throw new Error('face-api.js not loaded');
      }

      // Load models with retry mechanism
      const modelLoadPromises = [
        window.faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        window.faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        window.faceapi.nets.faceExpressionNet.loadFromUri('/models')
      ];

      await Promise.all(modelLoadPromises);
      
      console.log('Advanced emotion detection models loaded successfully');
      isModelsLoadedRef.current = true;
      setIsModelLoading(false);
      return true;
      
    } catch (err) {
      console.error('Failed to load emotion detection models:', err);
      setError('Could not load emotion detection models. Please ensure models are available.');
      setIsModelLoading(false);
      return false;
    }
  }, []);

  // Improved emotion analysis with better filtering
  const analyzeEmotion = useCallback(async (videoElement: HTMLVideoElement): Promise<EmotionData | null> => {
    if (!window.faceapi || !isModelsLoadedRef.current) return null;
    
    try {
      // Create canvas for processing if not exists
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = videoElement.videoWidth || 640;
        canvasRef.current.height = videoElement.videoHeight || 480;
      }

      const detection = await window.faceapi
        .detectSingleFace(videoElement, new window.faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.5
        }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detection && detection.expressions) {
        const expressions = detection.expressions;
        
        // Map to our emotion categories with better scoring
        const scores: EmotionScores = {
          happy: expressions.happy || 0,
          sad: expressions.sad || 0,
          angry: expressions.angry || 0,
          surprised: expressions.surprised || 0,
          neutral: expressions.neutral || 0
        };

        // Find dominant emotion with confidence threshold
        let dominantEmotion = 'neutral';
        let maxScore = 0.4; // Minimum threshold for emotion detection
        
        Object.entries(scores).forEach(([emotion, score]) => {
          if (score > maxScore) {
            maxScore = score;
            dominantEmotion = emotion;
          }
        });

        return {
          emotion: dominantEmotion,
          confidence: maxScore,
          timestamp: Date.now()
        };
      }
      
      return null;
      
    } catch (err) {
      console.error('Error in emotion analysis:', err);
      return null;
    }
  }, []);

  // Smooth emotion prediction with temporal filtering
  const updateEmotionWithSmoothing = useCallback((newEmotion: EmotionData) => {
    const history = emotionHistoryRef.current;
    history.push(newEmotion);
    
    // Keep only last 8 predictions for better smoothing
    if (history.length > 8) {
      history.shift();
    }
    
    // Remove old predictions (older than 3 seconds)
    const now = Date.now();
    emotionHistoryRef.current = history.filter(
      emotion => now - emotion.timestamp < 3000
    );
    
    // Calculate weighted average of recent emotions
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
      const score = data.count * avgConfidence; // Weight by frequency and confidence
      
      if (score > bestScore) {
        bestScore = score;
        bestEmotion = emotion;
      }
    });
    
    // Only update if confidence is high enough or emotion changed significantly
    const avgConfidence = emotionCounts[bestEmotion]?.totalConfidence / emotionCounts[bestEmotion]?.count || 0;
    
    if (bestEmotion !== currentEmotion || avgConfidence > 0.7) {
      console.log(`Emotion updated: ${bestEmotion} (confidence: ${avgConfidence.toFixed(2)})`);
      setCurrentEmotion(bestEmotion);
      setConfidence(avgConfidence);
    }
  }, [currentEmotion]);

  // Start emotion detection
  const startDetection = useCallback(async (videoElement: HTMLVideoElement) => {
    console.log('Starting advanced emotion detection...');
    
    const modelsLoaded = await initializeModels();
    if (!modelsLoaded) return;
    
    setIsActive(true);
    setError(null);
    
    // Clear previous interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Start detection with optimized interval
    detectionIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      
      // Throttle detection to avoid overwhelming the system
      if (now - lastDetectionRef.current < 600) return;
      lastDetectionRef.current = now;
      
      if (videoElement && videoElement.readyState === 4 && videoElement.videoWidth > 0) {
        const emotionData = await analyzeEmotion(videoElement);
        
        if (emotionData && emotionData.confidence > 0.3) {
          updateEmotionWithSmoothing(emotionData);
        }
      }
    }, 200); // Faster interval but with internal throttling
    
  }, [initializeModels, analyzeEmotion, updateEmotionWithSmoothing]);

  // Stop detection
  const stopDetection = useCallback(() => {
    console.log('Stopping advanced emotion detection...');
    
    setIsActive(false);
    setCurrentEmotion('neutral');
    setConfidence(0);
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Clear emotion history
    emotionHistoryRef.current = [];
    lastDetectionRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isActive,
    currentEmotion,
    confidence,
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
