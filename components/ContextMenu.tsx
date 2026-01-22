
import React, { useEffect, useRef } from 'react';
import { Trash2, Copy, ArrowUp, ArrowDown, Maximize, RotateCcw } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  actions: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      className="fixed z-[9999] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-1.5 w-48 animate-in fade-in zoom-in duration-100"
      style={{ left: x, top: y }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => { action.onClick(); onClose(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${action.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
        >
          <span className="opacity-60">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
};
