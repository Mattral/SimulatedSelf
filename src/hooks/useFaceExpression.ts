
import { useState, useRef, useCallback, useEffect } from 'react';

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

export const useFaceExpression = () => {
  const [currentExpression, setCurrentExpression] = useState<FaceExpression | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simple face expression analysis using basic face detection
  const analyzeFaceExpression = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!videoElement || videoElement.readyState !== 4) return;

    try {
      // Create canvas for face analysis
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 160;
        canvasRef.current.height = 120;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw current video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple brightness and contrast analysis to estimate mood
      let totalBrightness = 0;
      let totalContrast = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
      }

      const avgBrightness = totalBrightness / (data.length / 4);
      
      // Calculate variance for contrast
      let variance = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        variance += Math.pow(brightness - avgBrightness, 2);
      }
      totalContrast = Math.sqrt(variance / (data.length / 4));

      // Simple heuristic mapping to emotions
      const normalizedBrightness = Math.min(1, avgBrightness / 255);
      const normalizedContrast = Math.min(1, totalContrast / 100);

      // Generate expression probabilities based on simple heuristics
      const expressions = {
        neutral: 0.3 + (1 - Math.abs(normalizedBrightness - 0.5)) * 0.4,
        happy: normalizedBrightness * 0.6 + normalizedContrast * 0.2,
        sad: (1 - normalizedBrightness) * 0.4 + (1 - normalizedContrast) * 0.2,
        angry: normalizedContrast * 0.5 + (normalizedBrightness < 0.4 ? 0.3 : 0),
        surprised: normalizedContrast * 0.7,
        fearful: normalizedContrast * 0.3 + (normalizedBrightness < 0.3 ? 0.4 : 0),
        disgusted: (1 - normalizedBrightness) * 0.3 + normalizedContrast * 0.2
      };

      // Normalize probabilities
      const total = Object.values(expressions).reduce((sum, val) => sum + val, 0);
      Object.keys(expressions).forEach(key => {
        expressions[key as keyof typeof expressions] /= total;
      });

      // Find dominant emotion
      const dominantEmotion = Object.entries(expressions).reduce((a, b) => 
        expressions[a[0] as keyof typeof expressions] > expressions[b[0] as keyof typeof expressions] ? a : b
      );

      const faceExpression: FaceExpression = {
        emotion: dominantEmotion[0],
        confidence: dominantEmotion[1],
        expressions
      };

      setCurrentExpression(faceExpression);
    } catch (error) {
      console.warn('Face expression analysis error:', error);
    }
  }, []);

  const startAnalysis = useCallback((videoElement: HTMLVideoElement) => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    videoRef.current = videoElement;
    
    // Analyze every 500ms to avoid performance issues
    analysisIntervalRef.current = setInterval(() => {
      if (videoRef.current) {
        analyzeFaceExpression(videoRef.current);
      }
    }, 500);
  }, [isAnalyzing, analyzeFaceExpression]);

  const stopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    setCurrentExpression(null);
  }, []);

  useEffect(() => {
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, []);

  return {
    currentExpression,
    isAnalyzing,
    startAnalysis,
    stopAnalysis
  };
};
