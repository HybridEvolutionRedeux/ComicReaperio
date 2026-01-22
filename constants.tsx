
import React from 'react';

export const FONT_PRESETS = [
  'Bangers',
  'Arial',
  'Courier New',
  'Georgia',
  'Impact',
  'Verdana'
];

export const COLORS = [
  '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'
];

export const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #ffffff 0%, #e2e2e2 100%)',
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #434343 0%, #000000 100%)',
  'none'
];

export const SpeechBubble = ({ type, color = 'white', border = 'black', tailX = 20, tailY = 85 }: { type: string, color?: string, border?: string, tailX?: number, tailY?: number }) => {
  switch (type) {
    case 'thought':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
          <ellipse cx="50" cy="40" rx="45" ry="35" fill={color} stroke={border} strokeWidth="3" />
          <circle cx={tailX} cy={tailY} r="5" fill={color} stroke={border} strokeWidth="2" />
          <circle cx={tailX + (50 - tailX) * 0.3} cy={tailY + (40 - tailY) * 0.3} r="3" fill={color} stroke={border} strokeWidth="2" />
        </svg>
      );
    case 'shout':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
          <path d={`M5,40 L15,10 L40,5 L65,10 L95,40 L65,70 L${tailX},${tailY} L15,70 Z`} fill={color} stroke={border} strokeWidth="3" />
        </svg>
      );
    case 'whisper':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
          <path d={`M10,45 Q10,25 50,25 Q90,25 90,45 Q90,65 50,65 Q45,65 ${tailX},${tailY} Q35,65 10,65 Q10,45 10,45`} fill={color} stroke={border} strokeWidth="2" strokeDasharray="4,4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
          <path d={`M5,40 Q5,10 50,10 Q95,10 95,40 Q95,70 50,70 Q45,70 ${tailX},${tailY} Q35,70 5,70 Q5,40 5,40`} fill={color} stroke={border} strokeWidth="3" />
        </svg>
      );
  }
};
