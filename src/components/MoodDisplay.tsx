import React from 'react';
import { FaceExpression } from '../hooks/useFaceExpression';
interface MoodDisplayProps {
  expression: FaceExpression | null;
  isAnalyzing: boolean;
}
const MoodDisplay: React.FC<MoodDisplayProps> = ({
  expression,
  isAnalyzing
}) => {
  const getEmotionEmoji = (emotion: string) => {
    const emojiMap: Record<string, string> = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      surprised: '😮',
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
  if (!isAnalyzing) {
    return <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <h3 className="text-sm font-semibold mb-2">Mood Detection</h3>
        <p className="text-xs text-gray-400">Not active</p>
      </div>;
  }
  return <div className="bg-black/80 backdrop-blur-sm rounded-lg p-1 text-white min-w-20">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-3">
        <span>Mood Detection</span>
        {isAnalyzing && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
      </h3>
      
      {expression ? <div className="space-y-3">
          {/* Primary emotion display */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getEmotionEmoji(expression.emotion)}</span>
            <div>
              <p className={`font-medium capitalize ${getEmotionColor(expression.emotion)}`}>
                {expression.emotion}
              </p>
              <p className="text-xs text-gray-400">
                {(expression.confidence * 100).toFixed(0)}% confidence
              </p>
            </div>
          </div>

          {/* Expression breakdown */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-300 mb-1">Expression Analysis:</p>
            {Object.entries(expression.expressions).sort(([, a], [, b]) => b - a).slice(0, 3).map(([emotion, confidence]) => <div key={emotion} className="flex justify-between items-center">
                  <span className="text-xs capitalize flex items-center gap-1">
                    <span className="text-sm">{getEmotionEmoji(emotion)}</span>
                    {emotion}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${getEmotionColor(emotion).replace('text-', 'bg-')} transition-all duration-300`} style={{
                width: `${confidence * 100}%`
              }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">
                      {(confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>)}
          </div>
        </div> : <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
          <span className="text-xs text-gray-400">Analyzing...</span>
        </div>}
    </div>;
};
export default MoodDisplay;