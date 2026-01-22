
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Panel, Layer, LayerType } from '../types';
import { SpeechBubble } from '../constants';

interface PanelItemProps {
  panel: Panel;
  isSelected: boolean;
  selectedLayerId: string | null;
  multiSelectedLayerIds: string[];
  onUpdateLayer: (pId: string, lId: string, updates: Partial<Layer>) => void;
  onPointerDown: (e: any) => void;
  onContextMenu: (e: React.MouseEvent, panelId: string, layerId: string | null) => void;
  onLayerSelect: (layerId: string, multi: boolean) => void;
}

const LayerRenderer = ({ 
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
}: { 
  layer: Layer, 
  panelId: string, 
  isSelected: boolean, 
  isLayerSelected: boolean,
  isMultiSelected: boolean,
  onUpdateLayer: (pId: string, lId: string, updates: Partial<Layer>) => void,
  onContextMenu: (e: React.MouseEvent, pId: string, lId: string) => void,
  onLayerSelect: (lId: string, multi: boolean) => void,
  setDraggingLayerId: (id: string | null) => void,
  setDragStartPos: (pos: any) => void
}) => {
  const [draggingTailId, setDraggingTailId] = useState<string | null>(null);
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
        width: layer.type === LayerType.GROUP ? 'auto' : `${layer.scale * 100}%`, 
        height: layer.type === LayerType.GROUP ? 'auto' : 'auto',
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
              isLayerSelected={isLayerSelected} // Normally we only select the group itself but logic can vary
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
           {isLayerSelected && (
              <div 
                onPointerDown={(e) => { e.stopPropagation(); setDraggingTailId(layer.id); }} 
                className="absolute w-4 h-4 bg-yellow-400 border-2 border-black rounded-full cursor-crosshair z-[200] shadow-xl hover:scale-150 transition-transform" 
                style={{ left: `${layer.tailX}%`, top: `${layer.tailY}%`, transform: 'translate(-50%, -50%)' }} 
              />
           )}
           <div className="absolute inset-0 flex items-center justify-center p-[20%] text-center break-words leading-[1.1] select-none pointer-events-none comic-font" style={{ fontFamily: layer.font, fontSize: `${layer.fontSize}px`, color: layer.color }}>{layer.content}</div>
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

  return (
    <div 
      ref={panelRef}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => onContextMenu(e, panel.id, null)}
      className={`absolute cursor-move transition-all duration-300
        ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-4 z-[50] shadow-2xl scale-[1.005]' : 'z-[10]'}`}
      style={{ 
        left: panel.x, top: panel.y, width: panel.width, height: panel.height, 
        transform: `rotate(${panel.rotation}deg)`, border: `${panel.borderThickness}px solid ${panel.borderColor}`, 
        backgroundColor: panel.backgroundColor,
        boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 3}px rgba(0,0,0,0.5)` : 'none'
      }}
    >
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
