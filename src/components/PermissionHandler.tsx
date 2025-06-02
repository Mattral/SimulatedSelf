
import React, { useState } from 'react';
import { Camera, Mic, Shield, Play } from 'lucide-react';

interface PermissionHandlerProps {
  onPermissionsGranted: () => void;
}

export const PermissionHandler: React.FC<PermissionHandlerProps> = ({ onPermissionsGranted }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: true 
      });
      
      // Check if Speech Recognition is available
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
      }

      onPermissionsGranted();
    } catch (error) {
      console.error('Permission denied:', error);
      setError('Camera and microphone access is required for the HRI Simulator to work properly.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          {/* Icon */}
          <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6 flex items-center justify-center">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Welcome to HRI Simulator
          </h1>
          
          <p className="text-gray-600 mb-6">
            To create the best human-robot interaction experience, we need access to your camera and microphone.
          </p>

          {/* Permission Requirements */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Camera className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-800">Camera Access</div>
                <div className="text-sm text-gray-600">For real-time pose detection</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Mic className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-800">Microphone Access</div>
                <div className="text-sm text-gray-600">For voice interaction</div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Grant Permission Button */}
          <button
            onClick={requestPermissions}
            disabled={isRequesting}
            className={`
              w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200
              ${isRequesting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'
              }
              flex items-center justify-center space-x-2
            `}
          >
            {isRequesting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Requesting Permissions...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Start HRI Simulator</span>
              </>
            )}
          </button>

          {/* Privacy Note */}
          <p className="text-xs text-gray-500 mt-4">
            🔒 Your camera and audio data never leave your device. Everything is processed locally in your browser.
          </p>
        </div>
      </div>
    </div>
  );
};
