import React, { useState, useEffect, useRef } from 'react';

export const LoadingScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing camera...');
  
  const currentStepIndex = useRef(0);
  const currentProgress = useRef(0);

  useEffect(() => {
    const steps = [
      { text: 'Initializing camera...', duration: 1000 },
      { text: 'Loading pose detection models...', duration: 1500 },
      { text: 'Setting up 3D environment...', duration: 800 },
      { text: 'Preparing robot companion...', duration: 700 }
    ];

    const updateProgress = () => {
      if (currentStepIndex.current < steps.length) {
        const step = steps[currentStepIndex.current];
        setCurrentStep(step.text);

        const stepProgress = 100 / steps.length;
        const targetProgress = (currentStepIndex.current + 1) * stepProgress;

        const progressInterval = setInterval(() => {
          currentProgress.current += 2;
          setProgress(Math.min(currentProgress.current, targetProgress));

          if (currentProgress.current >= targetProgress) {
            clearInterval(progressInterval);
            currentStepIndex.current++;

            setTimeout(() => {
              if (currentStepIndex.current < steps.length) {
                updateProgress();
              } else {
                setProgress(100);
                setCurrentStep('Ready!');
                setTimeout(() => {
                  if (onComplete) onComplete();
                }, 500); // small delay to show "Ready!" before transition
              }
            }, 200);
          }
        }, 50);
      }
    };

    updateProgress();
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center">
      <div className="text-center">
        {/* Robot Loading Animation */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg mx-auto animate-pulse shadow-lg"></div>
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full mx-auto mt-2 animate-bounce shadow-md"></div>
          <div className="flex justify-center mt-2 space-x-1">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-800 mb-4">HRI Simulator</h1>
        <p className="text-xl text-gray-600 mb-8">Loading your robot companion...</p>

        {/* Loading Progress */}
        <div className="w-64 mx-auto">
          <div className="bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 animate-pulse">{currentStep}</p>
        </div>

        {/* Feature Preview */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3 flex items-center justify-center">🤖</div>
            <h3 className="font-semibold text-gray-800">3D Robot</h3>
            <p className="text-sm text-gray-600">Fully articulated humanoid</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3 flex items-center justify-center">🎯</div>
            <h3 className="font-semibold text-gray-800">Pose Tracking</h3>
            <p className="text-sm text-gray-600">Real-time mimicry</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3 flex items-center justify-center">🎤</div>
            <h3 className="font-semibold text-gray-800">Voice Chat</h3>
            <p className="text-sm text-gray-600">Speech recognition</p>
          </div>
        </div>
      </div>
    </div>
  );
};
