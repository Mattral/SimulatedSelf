
import React, { useEffect, useRef } from 'react';
import { Landmark } from '../hooks/usePoseDetection';

interface WebcamFeedProps {
  isActive: boolean;
  landmarks: any;
  videoElement?: HTMLVideoElement | null;
  className?: string;
}

export const WebcamFeed: React.FC<WebcamFeedProps> = ({ 
  isActive, 
  landmarks, 
  videoElement,
  className 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayVideoRef = useRef<HTMLVideoElement>(null);

  // Set up video display
  useEffect(() => {
    if (videoElement && displayVideoRef.current && isActive) {
      // Clone the video stream for display
      if (videoElement.srcObject) {
        displayVideoRef.current.srcObject = videoElement.srcObject;
        displayVideoRef.current.play().catch(console.error);
      }
    }
  }, [videoElement, isActive]);

  // Draw landmarks and connections
  useEffect(() => {
    if (!landmarks || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pose landmarks and connections
    if (landmarks.pose && landmarks.pose.length > 0) {
      console.log('Drawing pose landmarks:', landmarks.pose.length);
      
      // Draw pose connections first (lines)
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      drawPoseConnections(ctx, landmarks.pose, canvas.width, canvas.height);

      // Draw pose landmarks (dots)
      ctx.fillStyle = '#00ff00';
      landmarks.pose.forEach((landmark: Landmark, index: number) => {
        if (landmark.visibility && landmark.visibility > 0.5) {
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            4,
            0,
            2 * Math.PI
          );
          ctx.fill();
          
          // Add landmark numbers for debugging
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Arial';
          ctx.fillText(
            index.toString(),
            landmark.x * canvas.width + 5,
            landmark.y * canvas.height - 5
          );
          ctx.fillStyle = '#00ff00';
        }
      });
    }

    // Draw hand landmarks and connections
    if (landmarks.hands && landmarks.hands.length > 0) {
      console.log('Drawing hand landmarks:', landmarks.hands.length);
      
      landmarks.hands.forEach((hand: Landmark[], handIndex: number) => {
        const color = handIndex === 0 ? '#ff0000' : '#0000ff';
        
        // Draw hand connections
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        drawHandConnections(ctx, hand, canvas.width, canvas.height);

        // Draw hand landmarks
        ctx.fillStyle = color;
        hand.forEach((landmark: Landmark, index: number) => {
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            3,
            0,
            2 * Math.PI
          );
          ctx.fill();

          // Add landmark numbers for debugging
          ctx.fillStyle = '#ffffff';
          ctx.font = '8px Arial';
          ctx.fillText(
            index.toString(),
            landmark.x * canvas.width + 3,
            landmark.y * canvas.height - 3
          );
          ctx.fillStyle = color;
        });
      });
    }
  }, [landmarks]);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={displayVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover rounded-lg transform scale-x-[-1]"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute top-0 left-0 w-full h-full pointer-events-none transform scale-x-[-1]"
      />
      
      {/* Status indicators */}
      <div className="absolute top-2 right-2 flex gap-2">
        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        {landmarks?.pose && (
          <div className="bg-green-400 w-3 h-3 rounded-full animate-pulse" title="Pose detected" />
        )}
        {landmarks?.hands && landmarks.hands.length > 0 && (
          <div className="bg-blue-400 w-3 h-3 rounded-full animate-pulse" title="Hands detected" />
        )}
      </div>
      
      {/* Labels */}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        Live Pose & Hand Detection
      </div>
      
      {/* Debug info */}
      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {landmarks?.pose ? `Pose: ${landmarks.pose.length}` : 'No pose'} | 
        {landmarks?.hands ? ` Hands: ${landmarks.hands.length}` : ' No hands'}
      </div>
    </div>
  );
};

// MediaPipe Pose connections (33 landmarks)
const POSE_CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Body
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
];

// MediaPipe Hand connections (21 landmarks per hand)
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20]
];

// Helper function to draw pose connections
const drawPoseConnections = (ctx: CanvasRenderingContext2D, pose: Landmark[], width: number, height: number) => {
  POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const start = pose[startIdx];
    const end = pose[endIdx];
    
    if (start && end && 
        (!start.visibility || start.visibility > 0.5) && 
        (!end.visibility || end.visibility > 0.5)) {
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  });
};

// Helper function to draw hand connections
const drawHandConnections = (ctx: CanvasRenderingContext2D, hand: Landmark[], width: number, height: number) => {
  HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const start = hand[startIdx];
    const end = hand[endIdx];
    
    if (start && end) {
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  });
};
