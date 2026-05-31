
import { useState, useRef, useCallback, useEffect } from 'react';

// MediaPipe landmark interfaces
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseResults {
  pose?: Landmark[];
  hands?: Landmark[][];
  leftHand?: Landmark[];
  rightHand?: Landmark[];
}

/**
 * Performance note:
 *   The previous implementation called `setLandmarks(...)` on EVERY
 *   MediaPipe callback (~30Hz × 2 streams). That forced a full React
 *   re-render of <Index/> ~60 times per second and was the primary
 *   driver of GC thrashing.
 *
 *   The hook now writes the latest pose into a mutable `landmarksRef`
 *   on the hot path and only flushes a React state update at most
 *   every `RENDER_THROTTLE_MS`. Consumers that drive Three.js should
 *   read `landmarksRef.current` from inside their render loop
 *   (Scene3D already uses an imperative handle) and ignore the React
 *   state copy entirely.
 */
const RENDER_THROTTLE_MS = 100;

export const useMediaPipePoseDetection = () => {
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [landmarks, setLandmarks] = useState<PoseResults | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Hot-path mutable copy — read this from rAF loops. */
  const landmarksRef = useRef<PoseResults | null>(null);
  const lastFlushRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poseRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const writeLandmarks = (patch: Partial<PoseResults>) => {
    const next: PoseResults = { ...(landmarksRef.current || {}), ...patch };
    landmarksRef.current = next;
    const now = performance.now();
    if (now - lastFlushRef.current >= RENDER_THROTTLE_MS) {
      lastFlushRef.current = now;
      setLandmarks(next);
    }
  };

  // Load MediaPipe scripts dynamically with retry logic
  const loadMediaPipeScripts = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check if scripts are already loaded
      if (window.Pose && window.Hands && window.Camera) {
        console.log('MediaPipe scripts already loaded');
        resolve(true);
        return;
      }

      const scripts = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
      ];

      let loadedCount = 0;
      let hasError = false;

      const onScriptLoad = () => {
        loadedCount++;
        if (loadedCount === scripts.length && !hasError) {
          // Wait a bit for the global objects to be available
          setTimeout(() => {
            if (window.Pose && window.Hands && window.Camera) {
              console.log('All MediaPipe scripts loaded successfully');
              resolve(true);
            } else {
              console.error('MediaPipe objects not available after script load');
              resolve(false);
            }
          }, 500);
        }
      };

      const onScriptError = (error: any) => {
        console.error('Failed to load MediaPipe script:', error);
        hasError = true;
        resolve(false);
      };

      scripts.forEach((src) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onScriptLoad;
        script.onerror = onScriptError;
        document.head.appendChild(script);
      });
    });
  }, []);

  // Initialize MediaPipe models with retry logic
  const initializeModels = useCallback(async (): Promise<boolean> => {
    console.log('Initializing MediaPipe models... Attempt:', retryCountRef.current + 1);
    setIsModelLoading(true);
    setError(null);

    try {
      // Load scripts first
      const scriptsLoaded = await loadMediaPipeScripts();
      if (!scriptsLoaded) {
        throw new Error('Failed to load MediaPipe scripts');
      }

      // Initialize Pose detection
      const pose = new window.Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // Initialize Hands detection
      const hands = new window.Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      });

      // Pose results — written to ref, throttled into React state.
      pose.onResults((results: any) => {
        writeLandmarks({ pose: results.poseLandmarks || undefined });
      });

      // Hands results — written to ref, throttled into React state.
      hands.onResults((results: any) => {
        const handsData: Landmark[][] = [];
        let leftHand: Landmark[] | undefined;
        let rightHand: Landmark[] | undefined;

        if (results.multiHandLandmarks && results.multiHandedness) {
          results.multiHandLandmarks.forEach((handLandmarks: any, index: number) => {
            const handedness = results.multiHandedness![index];
            const lms = handLandmarks.map((lm: any) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z || 0,
            }));
            handsData.push(lms);
            if (handedness.label === 'Left') leftHand = lms;
            else rightHand = lms;
          });
        }

        writeLandmarks({ hands: handsData, leftHand, rightHand });
      });

      poseRef.current = pose;
      handsRef.current = hands;
      
      console.log('MediaPipe models initialized successfully');
      setIsModelLoading(false);
      retryCountRef.current = 0; // Reset retry count on success
      return true;
      
    } catch (err) {
      console.error('Error initializing MediaPipe models:', err);
      
      // Retry logic
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`Retrying initialization... Attempt ${retryCountRef.current + 1}/${maxRetries + 1}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await initializeModels();
      } else {
        setError('Failed to initialize pose detection models after multiple attempts. Please refresh the page.');
        setIsModelLoading(false);
        return false;
      }
    }
  }, [loadMediaPipeScripts]);

  // Start camera and detection
  const startDetection = useCallback(async () => {
    console.log('Starting pose and hand detection...');
    
    try {
      // Initialize models first if not already done
      if (!poseRef.current || !handsRef.current) {
        const initialized = await initializeModels();
        if (!initialized) {
          return;
        }
      }

      // Create video element
      const video = document.createElement('video');
      video.width = 640;
      video.height = 480;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      videoRef.current = video;

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      console.log('Camera initialized successfully');

      // Initialize camera for MediaPipe
      if (poseRef.current && handsRef.current) {
        const camera = new window.Camera(video, {
          onFrame: async () => {
            if (poseRef.current && handsRef.current && video.readyState === 4) {
              // Send frame to both pose and hands detection
              await poseRef.current.send({ image: video });
              await handsRef.current.send({ image: video });
            }
          },
          width: 640,
          height: 480
        });

        cameraRef.current = camera;
        camera.start();
        
        setIsDetectionActive(true);
        console.log('Detection started successfully');
      }

    } catch (err) {
      console.error('Error starting detection:', err);
      setError('Failed to start camera or detection');
      setIsDetectionActive(false);
    }
  }, [initializeModels]);

  // Stop detection
  const stopDetection = useCallback(() => {
    setIsDetectionActive(false);
    setLandmarks(null);
    landmarksRef.current = null;

    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // Reset pose
  const resetPose = useCallback(() => {
    setLandmarks(null);
    landmarksRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isDetectionActive,
    isModelLoading,
    landmarks,
    error,
    videoElement: videoRef.current,
    startDetection,
    stopDetection,
    resetPose
  };
};

// Declare global MediaPipe objects
declare global {
  interface Window {
    Pose: any;
    Hands: any;
    Camera: any;
  }
}
