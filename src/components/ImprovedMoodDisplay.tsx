
import React from 'react';

interface ImprovedMoodDisplayProps {
  emotion: string;
  confidence: number;
  expressions: Record<string, number>;
  isActive: boolean;
}

const ImprovedMoodDisplay: React.FC<ImprovedMoodDisplayProps> = ({
  emotion,
  confidence,
  expressions,
  isActive
}) => {
  const getEmotionEmoji = (emotion: string) => {
    const emojiMap: Record<string, string> = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      surprised: '😲',
      neutral: '😐',
      fearful: '😨',
      disgusted: '🤢'
    };
    return emojiMap[emotion] || '😐';
  };

  const getEmotionColor = (emotion: string) => {
    const colorMap: Record<string, string> = {
      happy: 'text-yellow-400',
      sad: 'text-blue-400',
      angry: 'text-red-400',
      surprised: 'text-purple-400',
      neutral: 'text-gray-400',
      fearful: 'text-orange-400',
      disgusted: 'text-green-400'
    };
    return colorMap[emotion] || 'text-gray-400';
  };

  if (!isActive) {
    return (
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2">AI Emotion Detection</h3>
        <p className="text-xs text-gray-400">Not active</p>
      </div>
    );
  }

  return (
    <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white min-w-64">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-3">
        <span>AI Emotion Detection</span>
        {isActive && <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />}
      </h3>
      
      {emotion && emotion !== 'neutral' ? (
        <div className="space-y-3">
          {/* Primary emotion display */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getEmotionEmoji(emotion)}</span>
            <div>
              <p className={`font-medium capitalize ${getEmotionColor(emotion)}`}>
                {emotion}
              </p>
              <p className="text-xs text-gray-400">
                {(confidence * 100).toFixed(0)}% confidence
              </p>
            </div>
          </div>

          {/* Expression breakdown */}
          {expressions && Object.keys(expressions).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-300 mb-1">Detailed Analysis:</p>
              {Object.entries(expressions)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([emotionType, conf]) => (
                  <div key={emotionType} className="flex justify-between items-center">
                    <span className="text-xs capitalize flex items-center gap-1">
                      <span className="text-sm">{getEmotionEmoji(emotionType)}</span>
                      {emotionType}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getEmotionColor(emotionType).replace('text-', 'bg-')} transition-all duration-300`}
                          style={{ width: `${conf * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">
                        {(conf * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" />
          <span className="text-xs text-gray-400">Analyzing emotions...</span>
        </div>
      )}
    </div>
  );
};

export default ImprovedMoodDisplay;
