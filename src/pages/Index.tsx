import React, { useEffect, useRef, useState } from 'react';
import { Scene3D } from '../components/Scene3D';
import { WebcamFeed } from '../components/WebcamFeed';
import { LoadingScreen } from '../components/LoadingScreen';
import { PermissionHandler } from '../components/PermissionHandler';
import MoodDisplay from '../components/MoodDisplay';
import VoiceChatPanel from '../components/VoiceChatPanel';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { useVoiceInteraction } from '../hooks/useVoiceInteraction';
import { useFaceExpression } from '../hooks/useFaceExpression';
import { useAdvancedEmotionDetection } from '../hooks/useAdvancedEmotionDetection';
import { useImprovedEmotionDetection } from '../hooks/useImprovedEmotionDetection';
import ImprovedMoodDisplay from '../components/ImprovedMoodDisplay';
const Index = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isHumanoidMode, setIsHumanoidMode] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showControlPanel, setShowControlPanel] = useState(true);
  const sceneRef = useRef<any>(null);
  const {
    isDetectionActive,
    isModelLoading,
    landmarks,
    error,
    videoElement,
    startDetection,
    stopDetection,
    resetPose
  } = usePoseDetection();
  const {
    status: voiceStatus,
    isListening,
    isProcessing,
    isStreaming,
    isSpeaking,
    isConfigured: isVoiceConfigured,
    transcribedText,
    partialResponse,
    lastResponse,
    lastError: voiceError,
    startListening,
    stopListening,
    cancel: cancelVoice,
    retry: retryVoice
  } = useVoiceInteraction();
  const {
    currentExpression,
    isAnalyzing: isMoodAnalyzing,
    startAnalysis: startMoodAnalysis,
    stopAnalysis: stopMoodAnalysis
  } = useFaceExpression();

  // Emotion detection disabled by default
  const {
    isActive: isEmotionDetectionActive,
    currentEmotion,
    confidence: emotionConfidence,
    isModelLoading: isEmotionModelLoading,
    startDetection: startEmotionDetection,
    stopDetection: stopEmotionDetection
  } = useAdvancedEmotionDetection();
  const {
    isActive: isImprovedEmotionActive,
    currentEmotion: improvedEmotion,
    confidence: improvedConfidence,
    expressions: improvedExpressions,
    isModelLoading: isImprovedEmotionModelLoading,
    error: improvedEmotionError,
    startDetection: startImprovedEmotionDetection,
    stopDetection: stopImprovedEmotionDetection
  } = useImprovedEmotionDetection();
  const handlePermissionsGranted = async () => {
    setHasPermissions(true);
    console.log('Permissions granted, starting detection...');
    await startDetection();
    setIsLoading(false);
  };
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  const handleMoodToggle = () => {
    if (isMoodAnalyzing) {
      stopMoodAnalysis();
    } else if (videoElement) {
      startMoodAnalysis(videoElement);
    }
  };
  const handleEmotionToggle = () => {
    if (isEmotionDetectionActive) {
      stopEmotionDetection();
    } else if (videoElement) {
      startEmotionDetection(videoElement);
    }
  };
  const handleImprovedEmotionToggle = () => {
    if (isImprovedEmotionActive) {
      stopImprovedEmotionDetection();
    } else if (videoElement) {
      startImprovedEmotionDetection(videoElement);
    }
  };
  const handleHumanoidToggle = () => {
    const newMode = !isHumanoidMode;
    setIsHumanoidMode(newMode);
    if (sceneRef.current) {
      sceneRef.current.setHumanoidMode(newMode);
    }
  };

  // Pass pose data to 3D skeleton
  useEffect(() => {
    if (sceneRef.current && landmarks) {
      sceneRef.current.updateSkeletonPose(landmarks);
    }
  }, [landmarks]);

  // Pass emotion data to humanoid robot (only if emotion detection is active)
  useEffect(() => {
    if (sceneRef.current && improvedEmotion && isHumanoidMode && isImprovedEmotionActive) {
      sceneRef.current.updateEmotion(improvedEmotion);
    }
  }, [improvedEmotion, isHumanoidMode, isImprovedEmotionActive]);

  // Remove auto-start for mood analysis - only manual activation
  // Remove auto-start for emotion detection - only manual activation

  // Show error if detection fails
  if (error) {
    return <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Detection Error</h1>
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Reload Page
          </button>
        </div>
      </div>;
  }

  // Show loading if models are still loading
  if (isLoading || isModelLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }
  if (!hasPermissions) {
    return <PermissionHandler onPermissionsGranted={handlePermissionsGranted} />;
  }
  return <div className="min-h-screen bg-gray-900 overflow-hidden">
      {/* Main 3D Scene */}
      <div className="relative w-full h-screen">
        <Scene3D ref={sceneRef} className="w-full h-full" isHumanoidMode={isHumanoidMode} />

        {/* Instructions Overlay */}
        {showInstructions && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center shadow-2xl">
              <div className="mb-6">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Best Performance Tip</h2>
                <p className="text-gray-600 text-sm mb-4">For the most accurate tracking and humanoid behavior:</p>
              </div>
              
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📷</span>
                  <p className="text-gray-700">Make sure your <strong>entire body is visible</strong> on camera when you start the experience.</p>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🖐️</span>
                  <p className="text-gray-700">Flip both your hands <strong>(palms facing forward)</strong> at the beginning — this helps the system correctly register your left and right hand placement.</p>
                </div>
              </div>
              
              <button onClick={() => setShowInstructions(false)} className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors w-full">
                Got it! Start Experience
              </button>
            </div>
          </div>}

        {/* Webcam Feed */}
        <div className="absolute bottom-4 left-4 hidden md:block">
          <WebcamFeed isActive={isDetectionActive} landmarks={landmarks} videoElement={videoElement} className="w-64 h-48 rounded-lg shadow-lg border-2 border-white/20" />
        </div>

        {/* Toggle Control Panel Button and Panel */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end z-50 space-y-2">

  {/* Toggle Button - Appears ABOVE the panel */}
  <button onClick={() => setShowControlPanel(!showControlPanel)} className="bg-black/70 hover:bg-black/90 text-white text-sm px-4 py-2 rounded-full shadow-lg transition-all" title={showControlPanel ? "Hide Control Panel" : "Show Control Panel"}>
    {showControlPanel ? '🙈 Hide Menu' : '👁️ Show Menu'}
  </button>

  {/* Control Panel */}
  {showControlPanel && <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 space-y-3 shadow-lg z-40">
      {/* Main Controls */}
      <div className="flex gap-2">
        <button onClick={handleMicToggle} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${voiceStatus === 'error' ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-300/50' : isListening ? 'bg-rose-500 hover:bg-rose-600 animate-pulse' : isProcessing ? 'bg-amber-500' : isStreaming ? 'bg-cyan-500 animate-pulse' : isSpeaking ? 'bg-emerald-500' : 'bg-blue-500 hover:bg-blue-600'}`} title="Toggle AI Voice Chat">
          {voiceStatus === 'error' ? '⚠️' : isProcessing || isStreaming ? '🤖' : isSpeaking ? '🔊' : '🎤'}
        </button>

        <button onClick={handleMoodToggle} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMoodAnalyzing ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 hover:bg-gray-700'}`} title="Toggle Basic Mood Detection">
          😊
        </button>

        <button onClick={handleImprovedEmotionToggle} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isImprovedEmotionActive ? 'bg-purple-500 hover:bg-purple-600' : 'bg-gray-600 hover:bg-gray-700'}`} title="Toggle Improved Emotion Detection">
          🎭
        </button>

        <button onClick={handleHumanoidToggle} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isHumanoidMode ? 'bg-purple-500 hover:bg-purple-600' : 'bg-gray-600 hover:bg-gray-700'}`} title="Toggle Humanoid Mode">
          🤖
        </button>

        <button onClick={resetPose} className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-700 flex items-center justify-center transition-all" title="Reset Pose">
          🔄
        </button>
      </div>

      {/* Voice chat HUD (Apple-grade glass panel) */}
      <VoiceChatPanel
        status={voiceStatus}
        isConfigured={isVoiceConfigured}
        transcribedText={transcribedText}
        partialResponse={partialResponse}
        lastResponse={lastResponse}
        lastError={voiceError}
        onCancel={cancelVoice}
        onRetry={retryVoice}
      />

      {/* Emotion Feedback */}
      {isImprovedEmotionActive && improvedEmotion !== 'neutral' && <div className="bg-purple-500/20 rounded p-2 text-white text-sm max-w-48">
          <p className="text-xs text-purple-300 mb-1">AI Emotion Detection:</p>
          <p className="capitalize">{improvedEmotion} ({(improvedConfidence * 100).toFixed(0)}%)</p>
          {improvedExpressions && Object.entries(improvedExpressions).sort(([, a], [, b]) => b - a).slice(0, 2).map(([emotion, conf]) => <p key={emotion} className="text-xs text-purple-200">
                {emotion}: {(conf * 100).toFixed(0)}%
              </p>)}
        </div>}

      {/* Status Indicators */}
      <div className="flex gap-2 items-center">
        <div className={`w-3 h-3 rounded-full ${isDetectionActive ? 'bg-green-400' : 'bg-red-400'}`} title="Camera Status" />
        <div className={`w-3 h-3 rounded-full ${landmarks?.pose ? 'bg-green-400' : 'bg-gray-400'}`} title="Pose Detection" />
        <div className={`w-3 h-3 rounded-full ${landmarks?.hands?.length ? 'bg-blue-400' : 'bg-gray-400'}`} title="Hand Detection" />
        <div className={`w-3 h-3 rounded-full ${isMoodAnalyzing ? 'bg-yellow-400' : 'bg-gray-400'}`} title="Basic Mood Analysis" />
        <div className={`w-3 h-3 rounded-full ${isImprovedEmotionActive ? 'bg-purple-400' : 'bg-gray-400'}`} title="AI Emotion Detection" />
        <div className={`w-3 h-3 rounded-full ${isHumanoidMode ? 'bg-purple-400' : 'bg-orange-400'}`} title="Display Mode" />
        <div className={`w-3 h-3 rounded-full ${isListening || isSpeaking || isProcessing ? 'bg-cyan-400' : 'bg-gray-400'}`} title="AI Chat Status" />
      </div>
    </div>}
      </div>


        {/* Mode Indicator */}
        <div className="absolute top-20 left-4">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
            <p className="text-sm font-medium">
              Mode: {isHumanoidMode ? '🤖 Humanoid (Default)' : '📍 Landmarks'}
            </p>
            {isImprovedEmotionActive && improvedEmotion !== 'neutral' && <p className="text-xs text-purple-300 capitalize">
                AI detected: {improvedEmotion} emotion
              </p>}
            {(isListening || isSpeaking || isProcessing) && <p className="text-xs text-cyan-300">
                {isProcessing ? '🤖 AI Processing...' : isListening ? '🎤 Listening...' : '🔊 Speaking...'}
              </p>}
          </div>
        </div>

        {/* Improved Mood Display (when improved emotion detection is active) */}
        {isImprovedEmotionActive && <div className="absolute top-4 right-4">
            <ImprovedMoodDisplay emotion={improvedEmotion} confidence={improvedConfidence} expressions={improvedExpressions} isActive={isImprovedEmotionActive} />
          </div>}

        {/* Basic Mood Display (only when basic mood analysis is active and improved is not) */}
        {isMoodAnalyzing && !isImprovedEmotionActive && <div className="absolute top-4 right-4">
            <MoodDisplay expression={currentExpression} isAnalyzing={isMoodAnalyzing} />
          </div>}

        {/* Title */}
        <div className="absolute top-4 left-4">
          <h1 className="font-bold text-white mb-2 text-xl">Simulated Self (Human-Robot Interaction)</h1>
          <p className="text-sm text-gray-300">This humanoid robot project was designed and developed by Min Htet Myet</p>
          <p className="text-xs text-cyan-300 mt-1">🤖 Now with AI voice chat powered by Groq Llama 3.1</p>
        </div>

        {/* Professional Instructions */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-1 text-white text-xs">
            <div className="flex items-center gap-3 text-gray-300 max-h-12">
              <span>🖱️ Drag rotate</span>
              <span>⚇ Scroll zoom</span>
              <span className="text-green-400">● Pose landmark</span>
              <span className="text-red-400">● Left Hand</span>
              <span className="text-blue-400">● Right Hand</span>
              <span className="text-purple-400">🤖 Mode</span>
              <span className="text-cyan-400">🎤 AI Chat</span>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Index;