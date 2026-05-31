/**
 * MoodDisplay
 * ---------------------------------------------------------------
 * Unified mood/emotion HUD. Replaces both the legacy MoodDisplay
 * (basic) and ImprovedMoodDisplay (AI). Renders the dominant
 * emotion plus a bar-chart breakdown of the top expressions.
 * ---------------------------------------------------------------
 */
import React from 'react';

export interface MoodDisplayProps {
  emotion: string | null;
  confidence: number;
  expressions: Record<string, number>;
  isActive: boolean;
  /** "basic" tints the pulse green; "ai" tints it purple. */
  variant?: 'basic' | 'ai';
}

const EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  surprised: '😲',
  neutral: '😐',
  fearful: '😨',
  disgusted: '🤢',
};

const COLOR: Record<string, string> = {
  happy: 'text-yellow-400',
  sad: 'text-blue-400',
  angry: 'text-red-400',
  surprised: 'text-purple-400',
  neutral: 'text-gray-400',
  fearful: 'text-orange-400',
  disgusted: 'text-green-400',
};

const MoodDisplay: React.FC<MoodDisplayProps> = ({
  emotion,
  confidence,
  expressions,
  isActive,
  variant = 'ai',
}) => {
  const title = variant === 'ai' ? 'AI Emotion Detection' : 'Mood Detection';
  const pulse = variant === 'ai' ? 'bg-purple-400' : 'bg-green-400';
  const spinner = variant === 'ai' ? 'border-purple-400' : 'border-blue-400';

  if (!isActive) {
    return (
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-xs text-gray-400">Not active</p>
      </div>
    );
  }

  const hasData = emotion && Object.keys(expressions).length > 0;

  return (
    <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white min-w-64">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-3">
        <span>{title}</span>
        <div className={`w-2 h-2 rounded-full animate-pulse ${pulse}`} />
      </h3>

      {hasData ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{EMOJI[emotion!] || '😐'}</span>
            <div>
              <p className={`font-medium capitalize ${COLOR[emotion!] || 'text-gray-400'}`}>
                {emotion}
              </p>
              <p className="text-xs text-gray-400">
                {(confidence * 100).toFixed(0)}% confidence
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-300 mb-1">Expression Analysis:</p>
            {Object.entries(expressions)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-xs capitalize flex items-center gap-1">
                    <span className="text-sm">{EMOJI[k] || '😐'}</span>
                    {k}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${(COLOR[k] || 'text-gray-400').replace('text-', 'bg-')} transition-all duration-300`}
                        style={{ width: `${v * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">
                      {(v * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className={`animate-spin w-4 h-4 border-2 ${spinner} border-t-transparent rounded-full`} />
          <span className="text-xs text-gray-400">Analyzing...</span>
        </div>
      )}
    </div>
  );
};

export default MoodDisplay;
