
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Panel, Layer, LayerType } from '../types';
import { SpeechBubble } from '../constants';
import { Zap, Loader2, Sparkles } from 'lucide-react';

interface PanelItemProps {
  panel: Panel;
  isSelected: boolean;
  isTargeted?: boolean;
  isProcessing?: boolean;
  selectedLayerId: string | null;
  multiSelectedLayerIds: string[];
  onUpdateLayer: (pId: string, lId: string, updates: Partial<Layer>) => void;
  onPointerDown: (e: any) => void;
  onContextMenu: (e: React.MouseEvent, panelId: string, layerId: string | null) => void;
  onLayerSelect: (layerId: string, multi: boolean) => void;
}

interface LayerRendererProps {
  layer: Layer;
  panelId: string;
  isSelected: boolean;
  isLayerSelected: boolean;
  isMultiSelected: boolean;
  onUpdateLayer: (pId: string, lId: string, updates: Partial<Layer>) => void;
  onContextMenu: (e: React.MouseEvent, pId: string, lId: string | null) => void;
  onLayerSelect: (lId: string, multi: boolean) => void;
  setDraggingLayerId: (id: string | null) => void;
  setDragStartPos: (pos: { x: number; y: number; layerX: number; layerY: number }) => void;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({ 
  layer, 
  panelId, 
  isSelected, 
  isLayerSelected, 
  isMultiSelected,
  onUpdateLayer, 
  onContextMenu, 
  onLayerSelect,
  setDraggingLayerId,
  setDragStartPos
}) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isLayerSelected || isMultiSelected) {
      e.stopPropagation();
      setDraggingLayerId(layer.id);
      setDragStartPos({ x: e.clientX, y: e.clientY, layerX: layer.x, layerY: layer.y });
    } else {
      e.stopPropagation();
      onLayerSelect(layer.id, e.shiftKey || e.ctrlKey || e.metaKey);
    }
  };

  const transform = `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`;

  return (
    <div 
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, panelId, layer.id); }}
      className={`absolute pointer-events-auto group 
        ${isLayerSelected ? 'outline outline-2 outline-indigo-500 outline-offset-4 z-[100]' : ''} 
        ${isMultiSelected ? 'outline outline-2 outline-indigo-400/50 outline-offset-4 z-[90]' : ''} 
        cursor-pointer transition-[outline,box-shadow]`} 
      style={{ 
        left: `${layer.x}%`, 
        top: `${layer.y}%`, 
        width: (layer.type === LayerType.GROUP || layer.type === LayerType.FREE_TEXT || layer.type === LayerType.NARRATION) ? 'auto' : `${layer.scale * 100}%`, 
        height: 'auto',
        transform, 
        opacity: layer.opacity, 
        zIndex: layer.zIndex
      }}
    >
      {layer.type === LayerType.GROUP ? (
        <div className="relative" style={{ width: '1px', height: '1px' }}>
          {layer.children?.map(child => (
            <LayerRenderer 
              key={child.id}
              layer={child}
              panelId={panelId}
              isSelected={isSelected}
              isLayerSelected={isLayerSelected}
              isMultiSelected={isMultiSelected}
              onUpdateLayer={onUpdateLayer}
              onContextMenu={onContextMenu}
              onLayerSelect={onLayerSelect}
              setDraggingLayerId={setDraggingLayerId}
              setDragStartPos={setDragStartPos}
            />
          ))}
        </div>
      ) : layer.type === LayerType.TEXT_BUBBLE ? (
        <div ref={bubbleRef} className="relative w-full h-full flex items-center justify-center p-6 min-w-[80px] min-h-[80px]">
           <SpeechBubble type={layer.bubbleType || 'speech'} tailX={layer.tailX} tailY={layer.tailY} color={layer.bubbleColor || 'white'} border={layer.bubbleBorderColor || 'black'} />
           <div className="absolute inset-0 flex items-center justify-center p-[20%] text-center break-words leading-[1.1] select-none pointer-events-none comic-font" style={{ fontFamily: layer.font, fontSize: `${layer.fontSize}px`, color: layer.color }}>{layer.content}</div>
        </div>
      ) : layer.type === LayerType.FREE_TEXT || layer.type === LayerType.NARRATION ? (
        <div 
          className={`whitespace-nowrap select-none pointer-events-none comic-font ${layer.type === LayerType.NARRATION ? 'bg-yellow-50 p-3 border-2 border-black shadow-md min-w-[150px]' : ''}`}
          style={{ fontFamily: layer.font, fontSize: `${layer.fontSize}px`, color: layer.color, transform: `scale(${layer.scale})` }}
        >
          {layer.content}
        </div>
      ) : (
        <img src={layer.content} alt={layer.name} className="w-full h-auto pointer-events-none drop-shadow-2xl" />
      )}
    </div>
  );
};

export const PanelItem = memo(({ 
  panel, 
  isSelected, 
  isTargeted,
  isProcessing,
  selectedLayerId, 
  multiSelectedLayerIds,
  onUpdateLayer, 
  onPointerDown, 
  onContextMenu,
  onLayerSelect
}: PanelItemProps) => {
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0, layerX: 0, layerY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (draggingLayerId && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStartPos.x) / rect.width * 100;
      const dy = (e.clientY - dragStartPos.y) / rect.height * 100;
      onUpdateLayer(panel.id, draggingLayerId, { 
        x: dragStartPos.layerX + dx, 
        y: dragStartPos.layerY + dy 
      });
    }
  }, [draggingLayerId, dragStartPos, panel.id, onUpdateLayer]);

  const handlePointerUp = useCallback(() => {
    setDraggingLayerId(null);
  }, []);

  useEffect(() => {
    if (draggingLayerId) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingLayerId, handlePointerMove, handlePointerUp]);

  const borderStyle = panel.panelStyle === 'action' ? 'skew(-2deg)' : 'none';

  return (
    <div 
      ref={panelRef}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => onContextMenu(e, panel.id, null)}
      className={`absolute cursor-move transition-all duration-300 overflow-hidden
        ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-4 z-[50] shadow-2xl scale-[1.005]' : 'z-[10]'}
        ${isTargeted ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
        ${isProcessing ? 'ring-4 ring-indigo-400 animate-pulse' : ''}`}
      style={{ 
        left: panel.x, top: panel.y, width: panel.width, height: panel.height, 
        transform: `rotate(${panel.rotation}deg) ${borderStyle}`, 
        border: panel.panelStyle === 'borderless' ? 'none' : `${panel.borderThickness}px solid ${panel.borderColor}`, 
        background: panel.backgroundColor,
        borderRadius: `${panel.borderRadius}px`,
        boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 3}px rgba(0,0,0,0.5)` : 'none'
      }}
    >
      {isProcessing && (
        <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-3 text-white">
           <Loader2 size={32} className="animate-spin text-indigo-400" />
           <div className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Sparkles size={12}/> Forging Script...
           </div>
        </div>
      )}
      {isTargeted && !isProcessing && (
        <div className="absolute inset-0 bg-yellow-400/10 pointer-events-none flex items-center justify-center">
          <Zap size={48} className="text-yellow-400 opacity-20" fill="currentColor" />
        </div>
      )}
      {[...panel.layers].sort((a,b) => a.zIndex - b.zIndex).map(layer => (
        <LayerRenderer 
          key={layer.id}
          layer={layer}
          panelId={panel.id}
          isSelected={isSelected}
          isLayerSelected={isSelected && selectedLayerId === layer.id}
          isMultiSelected={isSelected && multiSelectedLayerIds.includes(layer.id)}
          onUpdateLayer={onUpdateLayer}
          onContextMenu={onContextMenu}
          onLayerSelect={onLayerSelect}
          setDraggingLayerId={setDraggingLayerId}
          setDragStartPos={setDragStartPos}
        />
      ))}
    </div>
  );
});
