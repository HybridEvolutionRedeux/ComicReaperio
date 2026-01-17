
import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2 } from 'lucide-react';

interface FloatingWindowProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  width?: string;
  height?: string;
  resizable?: boolean;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({ 
  title, 
  onClose, 
  children, 
  initialX = 100, 
  initialY = 100,
  width = 'w-80',
  height = 'max-h-[80vh]',
  resizable = true
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: e.clientX - offset.current.x,
        y: e.clientY - offset.current.y
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      className={`fixed ${width} ${height} bg-[#252525] border border-[#3f3f3f] shadow-2xl rounded-lg z-[1000] flex flex-col overflow-hidden`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div 
        className="bg-[#333333] p-2 flex items-center justify-between cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <span className="text-sm font-semibold text-gray-300 ml-2">{title}</span>
        <div className="flex gap-2">
          <button className="hover:bg-[#444] p-1 rounded"><Minus size={14} /></button>
          <button className="hover:bg-[#444] p-1 rounded"><Maximize2 size={14} /></button>
          <button onClick={onClose} className="hover:bg-red-600 p-1 rounded"><X size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {children}
      </div>
    </div>
  );
};
