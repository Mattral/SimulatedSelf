
import React from 'react';
import { Mic, MicOff, RotateCcw, Moon, Sun, Palette } from 'lucide-react';

interface ControlPanelProps {
  isListening: boolean;
  isSpeaking: boolean;
  transcribedText: string;
  isDarkMode: boolean;
  isKidMode: boolean;
  onMicToggle: () => void;
  onResetPose: () => void;
  onThemeToggle: () => void;
  onKidModeToggle: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isListening,
  isSpeaking,
  transcribedText,
  isDarkMode,
  isKidMode,
  onMicToggle,
  onResetPose,
  onThemeToggle,
  onKidModeToggle
}) => {
  const panelClasses = `
    bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 shadow-lg
    ${isDarkMode ? 'bg-gray-900/10' : ''}
    ${isKidMode ? 'bg-purple-100/20 border-purple-300/30' : ''}
  `;

  const buttonClasses = `
    p-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95
    ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'}
    ${isKidMode ? 'hover:bg-purple-200/50' : ''}
  `;

  return (
    <div className={panelClasses}>
      <div className="flex flex-col space-y-3">
        {/* Microphone Control */}
        <button
          onClick={onMicToggle}
          className={`
            ${buttonClasses}
            ${isListening ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}
            ${isSpeaking ? 'animate-pulse' : ''}
          `}
          title={isListening ? 'Stop Listening' : 'Start Listening'}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        {/* Reset Pose */}
        <button
          onClick={onResetPose}
          className={`${buttonClasses} text-gray-700 dark:text-gray-300`}
          title="Reset Robot Pose"
        >
          <RotateCcw size={24} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className={`${buttonClasses} text-gray-700 dark:text-gray-300`}
          title="Toggle Dark Mode"
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>

        {/* Kid Mode Toggle */}
        <button
          onClick={onKidModeToggle}
          className={`
            ${buttonClasses}
            ${isKidMode ? 'bg-purple-500 text-white' : 'text-gray-700 dark:text-gray-300'}
          `}
          title="Toggle Kid Mode"
        >
          <Palette size={24} />
        </button>
      </div>

      {/* Transcribed Text Display */}
      {transcribedText && (
        <div className="mt-4 p-3 bg-black/20 rounded-lg">
          <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            "{transcribedText}"
          </p>
        </div>
      )}

      {/* Status Indicators */}
      <div className="mt-4 flex space-x-2">
        <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-400 animate-pulse' : 'bg-gray-400'}`} />
        <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
      </div>

      {/* Labels for mobile */}
      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <div>🔴 Listening</div>
        <div>🟢 Speaking</div>
      </div>
    </div>
  );
};
