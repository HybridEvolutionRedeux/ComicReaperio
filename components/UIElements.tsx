
import React, { useRef, useCallback } from 'react';
import { ChevronRight, Folder } from 'lucide-react';

export const RotationKnob = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => {
  const isDragging = useRef(false);
  
  const handleMove = useCallback((e: any) => {
    if (!isDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
    onChange(Math.round(angle));
  }, [onChange]);

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
      <div className="flex items-center gap-4">
        <div 
          className="w-12 h-12 rounded-full bg-black border border-white/10 relative cursor-pointer group shadow-xl"
          onMouseDown={() => { isDragging.current = true; }}
          onMouseUp={() => { isDragging.current = false; }}
          onMouseMove={handleMove}
          onMouseLeave={() => { isDragging.current = false; }}
        >
          <div 
            className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full transition-transform" 
            style={{ transform: `rotate(${value}deg)`, transformOrigin: '50% 22px' }} 
          />
          <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-700 pointer-events-none">{value}°</div>
        </div>
        <input 
          type="number" 
          value={value} 
          onChange={e => onChange(+e.target.value)}
          className="w-16 bg-black border border-white/5 p-2 rounded-lg text-[10px] font-mono text-indigo-400 outline-none" 
        />
      </div>
    </div>
  );
};

export const PropertySlider = ({ label, value, min, max, step = 1, onChange }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
      <span className="text-[10px] font-mono text-indigo-400">{value}</span>
    </div>
    <input 
      type="range" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={e => onChange(+e.target.value)} 
      className="w-full h-1.5 bg-black border border-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
    />
  </div>
);

export const PropertyField = ({ label, value, onChange }: { label: string, value: any, onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
    <input 
      type="text" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-black border border-white/5 p-3 rounded-2xl text-[11px] font-mono text-indigo-400 outline-none" 
    />
  </div>
);

export const ToolbarBtn = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3.5 rounded-xl relative group transition-all ${active ? 'bg-indigo-600 text-white shadow-xl' : 'hover:bg-white/5 text-gray-600 hover:text-white'}`}>
    {icon}
    <div className="absolute left-full ml-4 bg-black/90 px-3 py-2 rounded-xl text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity z-[500] whitespace-nowrap border border-white/10">{label}</div>
  </button>
);

export const ExplorerFolder = ({ label, active }: { label: string, active?: boolean }) => (
  <div className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${active ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'hover:bg-white/5 text-gray-700'}`}>
     <ChevronRight size={16} className={active ? 'rotate-90' : ''} />
     <Folder size={18} className={active ? 'text-indigo-400' : 'text-gray-800'} />
     <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </div>
);
