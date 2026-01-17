
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, Save, 
  Trash2, Type, Square, Layout, Move, RotateCw, 
  Eye, EyeOff, ChevronDown, ChevronUp, Image as ImageIcon,
  Maximize, ZoomIn, ZoomOut, SaveAll, FileJson,
  Scissors, Database, Info, GripHorizontal, Copy,
  Grid3X3, BookOpen, CreditCard, Lock, ChevronFirst, ChevronLast,
  ArrowUp, ArrowDown, User, Activity, AlertCircle, CheckCircle2,
  Terminal, ExternalLink, RefreshCw, AlertTriangle, ShieldAlert,
  Eraser, Target, Mountain, User as UserIcon, Sparkles, History,
  MousePointer2, Menu as MenuIcon, Upload, ImageDown, XCircle,
  FileImage, Frame, Wand, Send
} from 'lucide-react';
import { ComicProject, Panel, Layer, LayerType, AISettings, AISource, AIBackend } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import { SpeechBubble, FONT_PRESETS, COLORS } from './constants';
import { generateImage, enhancePrompt, removeBackgroundImage, extractSubject } from './services/geminiService';
import html2canvas from 'html2canvas';

const PAGE_PRESETS = {
  COMIC: { width: 1200, height: 1800, name: 'Standard Comic', description: '3-tier traditional layout' },
  MANGA: { width: 1000, height: 1500, name: 'Manga Page', description: '2-tier vertical focus' },
  POSTCARD: { width: 1800, height: 1200, name: 'Postcard', description: 'Landscape single panel' },
  COVER: { width: 1400, height: 2000, name: 'Book Cover', description: 'High-aspect ratio layout' },
  SQUARE: { width: 1080, height: 1080, name: 'Social Post', description: '1:1 grid layout' }
};

const INITIAL_PROJECT: ComicProject = {
  id: '1',
  title: 'New Comic Project',
  author: 'Artist',
  panels: [
    {
      id: 'p1',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      rotation: 0,
      zIndex: 1,
      borderThickness: 4,
      borderColor: '#000000',
      borderOpacity: 1,
      shadowIntensity: 4,
      backgroundColor: '#ffffff',
      layers: []
    }
  ],
  width: 1200,
  height: 1800,
  zoom: 0.4
};

const Knob: React.FC<{ value: number, onChange: (val: number) => void, label: string }> = ({ value, onChange, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    onChange(Math.round(angle));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isDragging]);

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">{label}</label>
      <div 
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="relative w-16 h-16 rounded-full bg-[#111] border-2 border-[#333] cursor-pointer flex items-center justify-center shadow-inner group active:scale-95 transition-transform"
      >
        <div 
          className="absolute w-1 h-6 bg-indigo-500 rounded-full origin-bottom -translate-y-3"
          style={{ transform: `rotate(${value}deg) translateY(-8px)` }}
        />
        <span className="text-[10px] font-mono font-bold text-gray-400 group-hover:text-white transition-colors">
          {value}°
        </span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [project, setProject] = useState<ComicProject>(INITIAL_PROJECT);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>('p1');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showTextWindow, setShowTextWindow] = useState(false);
  const [showPresetsWindow, setShowPresetsWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isExporting, setIsExporting] = useState(false);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'global' | 'panel' | 'layer-sidebar', panelId?: string, layerId?: string } | null>(null);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [aiSettings, setAiSettings] = useState<AISettings>({
    source: 'online',
    backend: 'gemini',
    endpoint: '',
    apiKey: '',
    model: 'gemini-2.5-flash-image',
    loras: [],
    removeBackground: true,
    targetType: 'character'
  });

  const [lastError, setLastError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);

  const [dragInfo, setDragInfo] = useState<{ 
    id: string, 
    layerId?: string,
    startX: number, 
    startY: number, 
    startPX: number, 
    startPY: number 
  } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 1024) {
        setShowLayers(false);
        setShowProperties(false);
      }
    };
    window.addEventListener('resize', handleResize);
    const savedHistory = localStorage.getItem('comiccraft_prompts');
    if (savedHistory) setPromptHistory(JSON.parse(savedHistory));
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getSelectedPanel = () => project.panels.find(p => p.id === selectedPanelId);
  const getSelectedLayer = () => {
    const panel = getSelectedPanel();
    return panel?.layers.find(l => l.id === selectedLayerId);
  };

  const currentPanel = getSelectedPanel();
  const currentLayer = getSelectedLayer();

  useEffect(() => {
    if (selectedPanelId) setTargetPanelId(selectedPanelId);
  }, [selectedPanelId]);

  const updatePanel = (panelId: string, updates: Partial<Panel>) => {
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === panelId ? { ...p, ...updates } : p)
    }));
  };

  const updateLayer = (panelId: string, layerId: string, updates: Partial<Layer>) => {
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === panelId ? {
        ...p,
        layers: p.layers.map(l => l.id === layerId ? { ...l, ...updates } : l)
      } : p)
    }));
  };

  const createPanel = (custom: Partial<Panel>): Panel => ({
    id: `p${Math.random().toString(36).substr(2, 9)}`,
    x: 150,
    y: 150,
    width: 400,
    height: 300,
    rotation: 0,
    zIndex: project.panels.length + 1,
    borderThickness: 4,
    borderColor: '#000000',
    borderOpacity: 1,
    shadowIntensity: 4,
    backgroundColor: '#ffffff',
    layers: [],
    ...custom
  });

  const addPanel = () => {
    const panel = createPanel({});
    setProject(prev => ({ ...prev, panels: [...prev.panels, panel] }));
    setSelectedPanelId(panel.id);
  };

  const applyLayoutPreset = (type: keyof typeof PAGE_PRESETS) => {
    const preset = PAGE_PRESETS[type];
    const newPanels: Panel[] = [];
    
    if (type === 'COMIC') {
      newPanels.push(createPanel({ x: 50, y: 50, width: preset.width - 100, height: 500, zIndex: 1 }));
      newPanels.push(createPanel({ x: 50, y: 600, width: (preset.width - 150) / 2, height: 500, zIndex: 2 }));
      newPanels.push(createPanel({ x: (preset.width / 2) + 25, y: 600, width: (preset.width - 150) / 2, height: 500, zIndex: 3 }));
      newPanels.push(createPanel({ x: 50, y: 1150, width: preset.width - 100, height: 600, zIndex: 4 }));
    } else if (type === 'MANGA') {
      newPanels.push(createPanel({ x: 50, y: 50, width: preset.width - 100, height: 400, zIndex: 1 }));
      newPanels.push(createPanel({ x: 50, y: 500, width: preset.width - 100, height: 950, zIndex: 2 }));
    } else if (type === 'SQUARE') {
      newPanels.push(createPanel({ x: 40, y: 40, width: preset.width - 80, height: preset.height - 80, zIndex: 1 }));
    } else if (type === 'POSTCARD') {
      newPanels.push(createPanel({ x: 50, y: 50, width: preset.width - 100, height: preset.height - 100, zIndex: 1 }));
    } else {
      newPanels.push(createPanel({ x: 50, y: 50, width: preset.width - 100, height: preset.height - 100, zIndex: 1 }));
    }

    setProject(prev => ({
      ...prev,
      width: preset.width,
      height: preset.height,
      panels: newPanels
    }));
    setShowPresetsWindow(false);
    if (newPanels.length > 0) setSelectedPanelId(newPanels[0].id);
  };

  const handlePointerDown = (e: React.PointerEvent, panelId: string, layerId?: string) => {
    if (e.button === 2) return; 
    e.stopPropagation();
    setContextMenu(null);
    if (layerId) {
      const panel = project.panels.find(p => p.id === panelId);
      const layer = panel?.layers.find(l => l.id === layerId);
      if (!layer) return;
      setSelectedPanelId(panelId);
      setSelectedLayerId(layerId);
      setDragInfo({ id: panelId, layerId, startX: e.clientX, startY: e.clientY, startPX: layer.x, startPY: layer.y });
    } else {
      const panel = project.panels.find(p => p.id === panelId);
      if (!panel) return;
      if (selectedLayerId) {
        setSelectedLayerId(null);
        return;
      }
      setSelectedPanelId(panelId);
      setDragInfo({ id: panelId, startX: e.clientX, startY: e.clientY, startPX: panel.x, startPY: panel.y });
    }
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfo) return;
    const dx = (e.clientX - dragInfo.startX) / project.zoom;
    const dy = (e.clientY - dragInfo.startY) / project.zoom;
    if (dragInfo.layerId) {
      const panel = project.panels.find(p => p.id === dragInfo.id);
      if (panel) {
        updateLayer(dragInfo.id, dragInfo.layerId, { x: dragInfo.startPX + (dx / panel.width) * 100, y: dragInfo.startPY + (dy / panel.height) * 100 });
      }
    } else {
      updatePanel(dragInfo.id, { x: dragInfo.startPX + dx, y: dragInfo.startPY + dy });
    }
  };

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'global' });
  };

  const handlePanelContextMenu = (e: React.MouseEvent, panelId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPanelId(panelId);
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'panel', panelId });
  };

  const handleLayerSidebarContextMenu = (e: React.MouseEvent, panelId: string, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPanelId(panelId);
    setSelectedLayerId(layerId);
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'layer-sidebar', panelId, layerId });
  };

  const duplicateLayer = (panelId: string, layerId: string) => {
    const panel = project.panels.find(p => p.id === panelId);
    const layer = panel?.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const newLayer: Layer = {
      ...layer,
      id: `l${Date.now()}`,
      name: `${layer.name} (Copy)`,
      x: layer.x + 5,
      y: layer.y + 5,
      zIndex: panel!.layers.length + 1
    };
    
    updatePanel(panelId, { layers: [...panel!.layers, newLayer] });
    setContextMenu(null);
    setSelectedLayerId(newLayer.id);
  };

  const sendLayerToPanel = (sourcePanelId: string, layerId: string, targetPanelId: string) => {
    if (sourcePanelId === targetPanelId) return;
    const sourcePanel = project.panels.find(p => p.id === sourcePanelId);
    const targetPanel = project.panels.find(p => p.id === targetPanelId);
    const layer = sourcePanel?.layers.find(l => l.id === layerId);
    
    if (!layer || !targetPanel) return;
    
    const movedLayer: Layer = {
      ...layer,
      zIndex: targetPanel.layers.length + 1
    };
    
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => {
        if (p.id === sourcePanelId) {
          return { ...p, layers: p.layers.filter(l => l.id !== layerId) };
        }
        if (p.id === targetPanelId) {
          return { ...p, layers: [...p.layers, movedLayer] };
        }
        return p;
      })
    }));
    
    setSelectedPanelId(targetPanelId);
    setSelectedLayerId(layerId);
    setContextMenu(null);
  };

  const savePromptToHistory = (p: string) => {
    if (!p.trim()) return;
    const newHistory = [p, ...promptHistory.filter(h => h !== p)].slice(0, 20);
    setPromptHistory(newHistory);
    localStorage.setItem('comiccraft_prompts', JSON.stringify(newHistory));
  };

  const handleGenerateImage = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setLastError(null);
    setOriginalPreview(null);
    savePromptToHistory(prompt);
    try {
      const enhanced = await enhancePrompt(prompt);
      const img = await generateImage(enhanced);
      setOriginalPreview(img);
      if (aiSettings.targetType === 'character' && aiSettings.removeBackground) {
        const processed = await removeBackgroundImage(img);
        setAiPreview(processed);
      } else {
        setAiPreview(img);
      }
    } catch (err: any) {
      setLastError(err.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePreviewBG = async () => {
    if (!aiPreview || !originalPreview) return;
    setIsGenerating(true);
    try {
      if (aiPreview === originalPreview) {
        const processed = await removeBackgroundImage(originalPreview);
        setAiPreview(processed);
      } else {
        setAiPreview(originalPreview);
      }
    } catch (err) {
      setLastError("Processing failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const acceptGeneration = () => {
    if (!aiPreview || !targetPanelId) return;
    const panel = project.panels.find(p => p.id === targetPanelId);
    if (!panel) return;
    const isBG = aiSettings.targetType === 'background';
    const newLayer: Layer = {
      id: `l${Date.now()}`,
      type: isBG ? LayerType.BACKGROUND : LayerType.CHARACTER,
      name: `${aiSettings.targetType.toUpperCase()}: ${prompt.slice(0, 10)}`,
      content: aiPreview,
      originalContent: originalPreview || undefined,
      hasBackgroundRemoved: !isBG && aiPreview !== originalPreview,
      x: 50,
      y: 50,
      scale: isBG ? 2.5 : 1,
      rotation: 0,
      opacity: 1,
      zIndex: isBG ? 0 : panel.layers.length + 1
    };
    updatePanel(targetPanelId, { layers: [...panel.layers, newLayer] });
    setAiPreview(null);
    setOriginalPreview(null);
  };

  const addTextBubble = (type: 'speech' | 'thought' | 'shout') => {
    if (!selectedPanelId) return;
    const panel = project.panels.find(p => p.id === selectedPanelId);
    if (!panel) return;
    
    const newLayer: Layer = {
      id: `l${Date.now()}`,
      type: LayerType.TEXT_BUBBLE,
      name: `Bubble: ${type}`,
      content: 'New Dialogue',
      bubbleType: type,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      zIndex: panel.layers.length + 1,
      fontSize: 16,
      color: '#000000',
      tailX: 20,
      tailY: 85
    };
    
    updatePanel(selectedPanelId, { layers: [...panel.layers, newLayer] });
    setSelectedLayerId(newLayer.id);
    setShowTextWindow(false);
  };

  const handlePropertyBGAction = async (panelId: string, layerId: string, action: 'remove' | 'restore' | 'extract') => {
    const panel = project.panels.find(p => p.id === panelId);
    const layer = panel?.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    setIsGenerating(true);
    setContextMenu(null);
    try {
      if (action === 'remove') {
        const processed = await removeBackgroundImage(layer.content);
        updateLayer(panelId, layerId, { originalContent: layer.originalContent || layer.content, content: processed, hasBackgroundRemoved: true });
      } else if (action === 'extract') {
        const processed = await extractSubject(layer.content);
        updateLayer(panelId, layerId, { originalContent: layer.originalContent || layer.content, content: processed, hasBackgroundRemoved: true });
      } else {
        if (layer.originalContent) {
          updateLayer(panelId, layerId, { content: layer.originalContent, hasBackgroundRemoved: false });
        }
      }
    } catch (err: any) {
      alert(err.message || "Operation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadProject = () => {
    const blob = new Blob([JSON.stringify(project)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title || 'comic'}.json`;
    a.click();
    setContextMenu(null);
  };

  const savePageAsPNG = async () => {
    if (!workspaceRef.current) return;
    setIsExporting(true);
    setContextMenu(null);
    
    setSelectedPanelId(null);
    setSelectedLayerId(null);
    
    try {
      const canvas = await html2canvas(workspaceRef.current, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2, 
        width: project.width,
        height: project.height,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('.export-target') as HTMLElement;
          if (el) {
            el.style.transform = 'none';
          }
        }
      });
      
      const link = document.createElement('a');
      link.download = `${project.title || 'comic_page'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const savePanelAsPNG = async (panelId: string) => {
    const el = panelRefs.current[panelId];
    if (!el) return;
    setIsExporting(true);
    setContextMenu(null);
    
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `panel_${panelId.slice(-4)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Panel export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const loadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setProject(json);
      } catch (err) {
        alert("Invalid project file.");
      }
    };
    reader.readAsText(file);
    setContextMenu(null);
  };

  const saveSelectedImage = () => {
    const layer = getSelectedLayer();
    if (!layer || !layer.content.startsWith('data:')) return;
    const a = document.createElement('a');
    a.href = layer.content;
    a.download = `comic_asset_${layer.id}.png`;
    a.click();
    setContextMenu(null);
  };

  const removeSelectedLayer = () => {
    if (!selectedPanelId || !selectedLayerId) return;
    const panel = project.panels.find(p => p.id === selectedPanelId);
    if (!panel) return;
    updatePanel(selectedPanelId, { layers: panel.layers.filter(l => l.id !== selectedLayerId) });
    setSelectedLayerId(null);
    setContextMenu(null);
  };

  return (
    <div 
      className="flex h-screen w-screen bg-[#121212] select-none overflow-hidden text-gray-200"
      onContextMenu={handleGlobalContextMenu}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={loadProject} />
      
      {/* Sidebar Navigation */}
      <div className={`${isMobile ? 'w-12' : 'w-16'} bg-[#1a1a1a] border-r border-[#333] flex flex-col items-center py-4 gap-6 z-[100]`} onContextMenu={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl comic-font shadow-lg">C</div>
        <div className="flex flex-col gap-2">
          <ToolbarButton icon={<Plus size={isMobile ? 20 : 24} />} label="Add Panel" onClick={addPanel} />
          <ToolbarButton icon={<Grid3X3 size={isMobile ? 20 : 24} />} label="Presets" onClick={() => setShowPresetsWindow(true)} />
          <ToolbarButton icon={<Type size={isMobile ? 20 : 24} />} label="Dialogue" onClick={() => setShowTextWindow(true)} />
          <ToolbarButton icon={<Wand2 size={isMobile ? 20 : 24} />} label="AI Studio" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
        </div>
        <div className="mt-auto flex flex-col gap-4 mb-4 text-gray-500">
          <ToolbarButton icon={<FileImage size={20} />} label="Export PNG" onClick={savePageAsPNG} />
          <ToolbarButton icon={<Download size={20} />} label="Export JSON" onClick={downloadProject} />
          <ToolbarButton icon={<Settings size={20} />} label="Settings" onClick={() => setShowSettingsWindow(true)} />
        </div>
      </div>

      {/* Main Workspace Canvas */}
      <div 
        className="flex-1 relative overflow-auto bg-[#0f0f0f] flex items-center justify-center custom-scrollbar" 
        onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); setContextMenu(null); }}
      >
        <div 
          ref={workspaceRef}
          className="bg-white shadow-2xl relative flex-none export-target"
          onContextMenu={e => e.stopPropagation()}
          style={{ 
            width: project.width, 
            height: project.height, 
            transform: `scale(${project.zoom})`,
            transition: 'transform 0.15s ease-out',
            transformOrigin: 'center center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {project.panels.map(panel => (
            <div
              key={panel.id}
              ref={el => panelRefs.current[panel.id] = el}
              onPointerDown={(e) => handlePointerDown(e, panel.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => { (e.target as Element).releasePointerCapture(e.pointerId); setDragInfo(null); }}
              onContextMenu={(e) => handlePanelContextMenu(e, panel.id)}
              className={`absolute cursor-move touch-none overflow-hidden ${selectedPanelId === panel.id ? 'ring-4 ring-indigo-500' : ''}`}
              style={{ 
                left: panel.x, 
                top: panel.y, 
                width: panel.width, 
                height: panel.height, 
                transform: `rotate(${panel.rotation}deg)`,
                border: `${panel.borderThickness}px solid ${panel.borderColor}${Math.floor(panel.borderOpacity * 255).toString(16).padStart(2, '0')}`,
                backgroundColor: panel.backgroundColor, 
                zIndex: panel.zIndex,
                boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 2}px rgba(0,0,0,0.4)` : 'none'
              }}
            >
              {[...panel.layers].sort((a,b) => a.zIndex - b.zIndex).map(layer => (
                <div
                  key={layer.id}
                  onPointerDown={(e) => handlePointerDown(e, panel.id, layer.id)}
                  className={`absolute pointer-events-auto cursor-pointer ${selectedLayerId === layer.id ? 'ring-2 ring-yellow-400' : ''}`}
                  style={{ 
                    left: `${layer.x}%`, 
                    top: `${layer.y}%`, 
                    width: `${layer.scale * 100}%`, 
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scaleX(${layer.flipX ? -1 : 1})`, 
                    opacity: layer.opacity, 
                    zIndex: layer.zIndex 
                  }}
                >
                  {layer.type === LayerType.TEXT_BUBBLE ? (
                    <div className="relative min-w-[120px] min-h-[80px]">
                      <SpeechBubble type={layer.bubbleType || 'speech'} tailX={layer.tailX} tailY={layer.tailY} />
                      <div className="absolute inset-0 flex items-center justify-center p-4 text-center comic-font text-black" style={{ fontSize: layer.fontSize }}>{layer.content}</div>
                    </div>
                  ) : <img src={layer.content} alt={layer.name} className="w-full h-auto pointer-events-none" />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Zoom Controls Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#333] rounded-full p-1 flex items-center gap-2 shadow-2xl z-50 scale-75 md:scale-100" onContextMenu={e => e.stopPropagation()}>
          <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="p-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white">
            <ZoomOut size={18} />
          </button>
          <span className="text-[10px] font-black text-gray-400 w-12 text-center uppercase tracking-tighter">{Math.round(project.zoom * 100)}%</span>
          <button onClick={() => setProject(p => ({...p, zoom: Math.min(2, p.zoom + 0.1)}))} className="p-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white">
            <ZoomIn size={18} />
          </button>
        </div>

        {/* Overlays for Exporting and AI Generation */}
        {isExporting && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[5000] backdrop-blur-sm animate-in fade-in">
             <div className="flex flex-col items-center gap-4">
                <RefreshCw className="animate-spin text-indigo-500" size={48} />
                <span className="text-xl font-black comic-font tracking-widest animate-pulse">CAPTURING MASTERPIECE...</span>
             </div>
          </div>
        )}

        {isGenerating && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[4500] backdrop-blur-[2px]">
             <div className="flex flex-col items-center gap-2">
                <Wand2 className="animate-pulse text-yellow-400" size={32} />
                <span className="text-xs font-bold tracking-tighter text-white uppercase italic">Processing Layer...</span>
             </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Layers and Properties */}
      {(showLayers || showProperties) && (
        <div className="w-80 bg-[#1a1a1a] border-l border-[#333] flex flex-col h-full z-50 overflow-y-auto custom-scrollbar hidden lg:flex" onContextMenu={e => e.stopPropagation()}>
          <CollapsiblePanel title="Scene Manager" icon={<Layers size={14} />} isOpen={showLayers} onToggle={() => setShowLayers(!showLayers)}>
            <div className="p-2 space-y-2">
              {project.panels.map(panel => (
                <div key={panel.id} className={`p-2 rounded border border-[#333] ${selectedPanelId === panel.id ? 'bg-indigo-900/20 border-indigo-500/50' : ''}`}>
                  <div className="text-[10px] font-bold uppercase mb-1 flex justify-between">Panel {panel.id.slice(-4)}</div>
                  {panel.layers.map(l => (
                    <div 
                      key={l.id} 
                      className={`text-[9px] p-1 rounded transition-colors select-none ${selectedLayerId === l.id ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-400 cursor-pointer hover:bg-white/5'}`} 
                      onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(l.id); }}
                      onContextMenu={(e) => handleLayerSidebarContextMenu(e, panel.id, l.id)}
                    >
                      {l.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel title="Properties" icon={<Settings size={14} />} isOpen={showProperties} onToggle={() => setShowProperties(!showProperties)}>
            <div className="p-4 space-y-6">
              {currentLayer ? (
                <div className="space-y-4">
                  <LayerProperties layer={currentLayer} onUpdate={(u) => updateLayer(selectedPanelId!, selectedLayerId!, u)} allLayers={currentPanel?.layers || []} />
                  {(currentLayer.type === LayerType.CHARACTER || currentLayer.type === LayerType.ASSET || currentLayer.type === LayerType.BACKGROUND) && (
                    <div className="pt-4 border-t border-[#333] space-y-3">
                      <label className="text-[10px] font-bold uppercase text-indigo-400">Processing</label>
                      <div className="grid grid-cols-2 gap-2">
                        {!currentLayer.hasBackgroundRemoved ? (
                          <>
                            <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'remove')} className="bg-indigo-600/10 border border-indigo-500/30 p-2 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-2 hover:bg-indigo-600/20 transition-all"><Eraser size={12}/> Clear BG</button>
                            <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'extract')} className="bg-yellow-600/10 border border-yellow-500/30 p-2 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-2 hover:bg-yellow-600/20 transition-all"><Wand size={12}/> Magic Cut</button>
                          </>
                        ) : (
                          <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'restore')} className="col-span-2 bg-[#222] border border-[#333] p-2 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-2 hover:bg-[#333] transition-all"><RefreshCw size={12}/> Restore Original</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : currentPanel ? (
                <PanelProperties panel={currentPanel} onUpdate={(u) => updatePanel(selectedPanelId!, u)} />
              ) : <div className="text-center text-[10px] text-gray-500 py-10 uppercase font-bold">Select a target</div>}
            </div>
          </CollapsiblePanel>
        </div>
      )}

      {/* Dynamic Context Menus */}
      {contextMenu && (
        <div 
          className="fixed bg-[#1a1a1a] border border-[#333] shadow-2xl rounded-lg z-[2000] overflow-hidden w-64 flex flex-col animate-in fade-in zoom-in duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={e => e.stopPropagation()}
        >
          {contextMenu.type === 'panel' ? (
            <>
              <div className="p-2 bg-[#111] text-[9px] font-black uppercase tracking-widest text-indigo-500 border-b border-[#333]">Panel: {contextMenu.panelId?.slice(-4)}</div>
              <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiSettings(s => ({...s, targetType: 'character'})); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]"><UserIcon size={14}/> Generate Character</button>
              <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiSettings(s => ({...s, targetType: 'background'})); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]"><Mountain size={14}/> Generate Background</button>
              
              <button onClick={() => savePanelAsPNG(contextMenu.panelId!)} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]"><Frame size={14}/> Save Panel as PNG</button>
              
              {selectedLayerId && (
                <>
                  <div className="p-2 bg-[#111] text-[8px] font-black uppercase tracking-widest text-yellow-500 border-y border-[#333]">Layer Actions</div>
                  <button onClick={saveSelectedImage} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold"><ImageDown size={14}/> Save Current Asset</button>
                  <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'remove')} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold"><Eraser size={14}/> AI Background Removal</button>
                  <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'extract')} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold"><Wand size={14}/> Magic Subject Extract</button>
                  <button onClick={removeSelectedLayer} className="flex items-center gap-3 p-3 text-xs hover:bg-red-600/20 text-red-400 hover:text-white text-left font-bold"><Trash2 size={14}/> Remove Asset</button>
                </>
              )}
              <div className="border-t border-[#333]"></div>
              <button onClick={() => { setProject(p => ({...p, panels: p.panels.filter(pan => pan.id !== contextMenu.panelId)})); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-red-600 transition-colors text-left font-bold text-red-400 hover:text-white"><XCircle size={14}/> Delete Entire Panel</button>
            </>
          ) : contextMenu.type === 'layer-sidebar' ? (
            <>
              <div className="p-2 bg-[#111] text-[9px] font-black uppercase tracking-widest text-yellow-500 border-b border-[#333]">Sidebar Action</div>
              <button onClick={() => duplicateLayer(contextMenu.panelId!, contextMenu.layerId!)} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]"><Copy size={14}/> Duplicate Layer</button>
              
              <div className="p-2 bg-[#111] text-[8px] font-black uppercase tracking-widest text-gray-500 border-b border-[#333]">Send to Panel</div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {project.panels.map(p => (
                  <button 
                    key={p.id} 
                    disabled={p.id === contextMenu.panelId}
                    onClick={() => sendLayerToPanel(contextMenu.panelId!, contextMenu.layerId!, p.id)}
                    className={`w-full flex items-center gap-3 p-2.5 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]/50 ${p.id === contextMenu.panelId ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <Send size={12}/> Panel {p.id.slice(-4)}
                  </button>
                ))}
              </div>
              <button onClick={removeSelectedLayer} className="flex items-center gap-3 p-3 text-xs hover:bg-red-600/20 text-red-400 hover:text-white text-left font-bold"><Trash2 size={14}/> Remove Layer</button>
            </>
          ) : (
            <>
              <div className="p-2 bg-[#111] text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-[#333]">Project Actions</div>
              <button onClick={addPanel} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]"><Plus size={14}/> New Panel</button>
              <button onClick={() => setShowPresetsWindow(true)} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold border-b border-[#333]"><Layout size={14}/> Load Preset</button>
              
              <div className="p-2 bg-[#111] text-[8px] font-black uppercase tracking-widest text-gray-500 border-y border-[#333]">Save & Load</div>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold"><Upload size={14}/> Import Project (JSON)</button>
              <button onClick={downloadProject} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold"><Save size={14}/> Export Project (JSON)</button>
              <button onClick={savePageAsPNG} className="flex items-center gap-3 p-3 text-xs hover:bg-green-600/20 text-green-400 hover:text-white text-left font-bold border-t border-[#333]"><FileImage size={14}/> Save Page as PNG</button>
              
              <div className="border-t border-[#333]"></div>
              <button onClick={() => setShowSettingsWindow(true)} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/20 text-left font-bold"><Settings size={14}/> Project Settings</button>
            </>
          )}
        </div>
      )}

      {/* Asset Generation, Presets, and Project Windows */}
      {showAIWindow && (
        <FloatingWindow title="AI Art Studio" onClose={() => setShowAIWindow(false)} width={isMobile ? 'w-[90vw]' : 'w-[500px]'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-[#111] p-3 rounded border border-[#333]">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Panel</label>
                <select className="w-full bg-black border border-[#333] p-2 rounded text-[10px] font-bold text-indigo-400 outline-none" value={targetPanelId || ''} onChange={(e) => setTargetPanelId(e.target.value)}>
                  {project.panels.map(p => <option key={p.id} value={p.id}>Panel {p.id.slice(-4)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Mode</label>
                <div className="flex bg-black p-1 rounded border border-[#333]">
                  <button onClick={() => setAiSettings({...aiSettings, targetType: 'background'})} className={`flex-1 p-1 rounded text-[9px] font-bold uppercase ${aiSettings.targetType === 'background' ? 'bg-indigo-600' : 'text-gray-500'}`}>BG</button>
                  <button onClick={() => setAiSettings({...aiSettings, targetType: 'character'})} className={`flex-1 p-1 rounded text-[9px] font-bold uppercase ${aiSettings.targetType === 'character' ? 'bg-indigo-600' : 'text-gray-500'}`}>Hero</button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <textarea 
                className="w-full bg-[#111] border border-[#333] rounded p-3 text-sm h-32 focus:border-indigo-500 outline-none font-bold" 
                placeholder="Describe your asset..." 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
              />
              {promptHistory.length > 0 && (
                <div className="flex flex-wrap gap-1">
                   {promptHistory.map((h, i) => (
                     <button key={i} onClick={() => setPrompt(h)} className="text-[8px] bg-[#222] border border-[#333] px-2 py-1 rounded text-gray-500 hover:text-indigo-400 hover:border-indigo-500 truncate max-w-[120px]">{h}</button>
                   ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <button onClick={async () => setPrompt(await enhancePrompt(prompt))} className="bg-[#222] p-2 rounded text-[10px] font-bold uppercase flex items-center gap-1"><Sparkles size={12}/> Enhance</button>
              <button onClick={handleGenerateImage} disabled={isGenerating} className="flex-1 bg-indigo-600 p-2 rounded text-xs font-black uppercase flex items-center justify-center gap-2">
                {isGenerating ? <RefreshCw className="animate-spin" size={14}/> : <ImageIcon size={14}/>} {isGenerating ? 'Drawing...' : 'Generate'}
              </button>
            </div>

            {aiPreview && (
              <div className="pt-4 border-t border-[#333] space-y-3">
                <div className="dark-transparency-grid rounded border border-[#333] overflow-hidden aspect-video relative flex items-center justify-center">
                  <img src={aiPreview} className="max-w-full max-h-full object-contain" alt="preview" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setAiPreview(null); setOriginalPreview(null); }} className="flex-1 bg-[#222] p-2 rounded text-[10px] font-bold uppercase">Discard</button>
                  <button onClick={acceptGeneration} className="flex-[2] bg-indigo-600 p-2 rounded text-[10px] font-bold uppercase">Place in Panel</button>
                </div>
              </div>
            )}
          </div>
        </FloatingWindow>
      )}

      {showPresetsWindow && (
        <FloatingWindow title="Layout Presets" onClose={() => setShowPresetsWindow(false)} width="w-80">
          <div className="space-y-2">
            {Object.entries(PAGE_PRESETS).map(([key, value]) => (
              <button key={key} onClick={() => applyLayoutPreset(key as keyof typeof PAGE_PRESETS)} className="w-full bg-[#1a1a1a] hover:bg-[#333] border border-[#333] p-3 rounded flex items-center gap-4 group transition-colors">
                <div className="w-10 h-10 rounded bg-[#222] flex items-center justify-center group-hover:bg-indigo-600 transition-colors"><Layout size={20} className="text-gray-400 group-hover:text-white" /></div>
                <div className="text-left">
                  <div className="text-[11px] font-black uppercase tracking-widest">{value.name}</div>
                  <div className="text-[9px] text-indigo-400 font-mono">{value.width} x {value.height}</div>
                </div>
              </button>
            ))}
          </div>
        </FloatingWindow>
      )}

      {showSettingsWindow && (
        <FloatingWindow title="Settings" onClose={() => setShowSettingsWindow(false)} width="w-80">
          <div className="space-y-4 p-2">
            <div className="space-y-2">
               <label className="text-[10px] text-gray-500 font-bold uppercase">Author</label>
               <input type="text" value={project.author} onChange={e => setProject({...project, author: e.target.value})} className="w-full bg-black p-2 rounded border border-[#333] text-xs" />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] text-gray-500 font-bold uppercase">Title</label>
               <input type="text" value={project.title} onChange={e => setProject({...project, title: e.target.value})} className="w-full bg-black p-2 rounded border border-[#333] text-xs" />
            </div>
          </div>
        </FloatingWindow>
      )}

      {showTextWindow && (
        <FloatingWindow title="Dialogue" onClose={() => setShowTextWindow(false)} width="w-72">
          <div className="space-y-3">
            <button onClick={() => addTextBubble('speech')} className="w-full bg-[#111] hover:bg-[#222] p-4 rounded border border-[#333] flex items-center gap-4 group"><div className="w-8 h-8 bg-white rounded flex items-center justify-center"><Square size={16} color="black"/></div><span className="text-xs font-black uppercase">Speech</span></button>
            <button onClick={() => addTextBubble('thought')} className="w-full bg-[#111] hover:bg-[#222] p-4 rounded border border-[#333] flex items-center gap-4 group"><div className="w-8 h-8 bg-white/40 rounded flex items-center justify-center"><Square size={16} color="black"/></div><span className="text-xs font-black uppercase">Thought</span></button>
            <button onClick={() => addTextBubble('shout')} className="w-full bg-[#111] hover:bg-[#222] p-4 rounded border border-[#333] flex items-center gap-4 group"><div className="w-8 h-8 bg-white rounded flex items-center justify-center -rotate-12"><Square size={16} color="black"/></div><span className="text-xs font-black uppercase italic">Shout</span></button>
          </div>
        </FloatingWindow>
      )}
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3 rounded-lg group relative transition-all ${active ? 'bg-indigo-600 text-white' : 'hover:bg-[#333] text-gray-400'}`}>
    {icon}
    <span className="absolute left-full ml-3 bg-black p-2 rounded text-[10px] font-bold uppercase whitespace-nowrap hidden group-hover:block z-[200] border border-[#333]">{label}</span>
  </button>
);

const CollapsiblePanel = ({ title, icon, children, isOpen, onToggle }: any) => (
  <div className={`flex flex-col border-b border-[#333] ${!isOpen ? 'h-10 flex-none' : 'flex-1 min-h-0'}`}>
    <div className="p-3 bg-[#222] flex justify-between items-center cursor-pointer transition-colors hover:bg-[#2a2a2a]" onClick={onToggle}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">{icon} {title}</div>
      {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
    </div>
    {isOpen && children}
  </div>
);

const PanelProperties = ({ panel, onUpdate }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="text-[10px] font-bold uppercase text-indigo-400 border-b border-[#333] pb-2 flex items-center gap-2"><Layout size={12}/> Panel Settings</div>
      <div className="space-y-4">
        <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest block">Dimensions</label>
        <div className="space-y-4">
          <div className="space-y-1">
             <div className="flex justify-between text-[8px] font-mono"><span className="text-gray-600">WIDTH</span> <span>{panel.width}px</span></div>
             <input type="range" min="100" max="1200" value={panel.width} onChange={e => onUpdate({width: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded appearance-none" />
          </div>
          <div className="space-y-1">
             <div className="flex justify-between text-[8px] font-mono"><span className="text-gray-600">HEIGHT</span> <span>{panel.height}px</span></div>
             <input type="range" min="100" max="1800" value={panel.height} onChange={e => onUpdate({height: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded appearance-none" />
          </div>
        </div>
      </div>
      <div className="flex justify-center bg-black/20 rounded-lg p-2"><Knob label="Panel Angle" value={panel.rotation} onChange={(val) => onUpdate({ rotation: val })} /></div>
      <div className="space-y-4">
        <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest flex justify-between">Border Size <span>{panel.borderThickness}px</span></label>
        <input type="range" min="0" max="40" value={panel.borderThickness} onChange={e => onUpdate({borderThickness: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded appearance-none" />
      </div>
      <div className="space-y-4">
        <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest flex justify-between">Shadow Power <span>{panel.shadowIntensity}px</span></label>
        <input type="range" min="0" max="50" value={panel.shadowIntensity} onChange={e => onUpdate({shadowIntensity: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded appearance-none" />
      </div>
    </div>
  );
};

const LayerProperties = ({ layer, onUpdate, allLayers }: any) => {
  const maxZ = allLayers.length > 0 ? Math.max(...allLayers.map((l: any) => l.zIndex)) : 0;
  const minZ = allLayers.length > 0 ? Math.min(...allLayers.map((l: any) => l.zIndex)) : 0;
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="text-[10px] font-bold uppercase text-yellow-500 border-b border-[#333] pb-2 flex items-center gap-2"><Layers size={12}/> Layer Control</div>
      {layer.type === LayerType.TEXT_BUBBLE && (
        <div className="space-y-2">
           <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">DIALOGUE</label>
           <textarea value={layer.content} onChange={e => onUpdate({content: e.target.value})} className="w-full bg-black border border-[#333] p-2 rounded text-xs h-20 outline-none focus:border-yellow-500 transition-colors" />
        </div>
      )}
      <div className="space-y-4">
        <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest flex justify-between">Transformations</label>
        <div className="space-y-4">
          <div className="space-y-1">
             <div className="flex justify-between text-[8px] font-mono"><span className="text-gray-600">SCALE</span> <span>{layer.scale.toFixed(2)}x</span></div>
             <input type="range" min="0.1" max="5" step="0.1" value={layer.scale} onChange={e => onUpdate({scale: +e.target.value})} className="w-full h-1 accent-yellow-500 bg-[#333] rounded appearance-none" />
          </div>
          <div className="space-y-1">
             <div className="flex justify-between text-[8px] font-mono"><span className="text-gray-600">OPACITY</span> <span>{Math.round(layer.opacity * 100)}%</span></div>
             <input type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={e => onUpdate({opacity: +e.target.value})} className="w-full h-1 accent-yellow-500 bg-[#333] rounded appearance-none" />
          </div>
        </div>
      </div>
      <div className="flex justify-center bg-black/20 rounded-lg p-2"><Knob label="Rotation" value={layer.rotation} onChange={(val) => onUpdate({ rotation: val })} /></div>
      <div className="space-y-2">
          <label className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Stacking Order</label>
          <div className="flex gap-1">
              <button onClick={() => onUpdate({zIndex: minZ - 1})} className="flex-1 bg-[#111] p-2 rounded border border-[#333] hover:border-yellow-500 flex justify-center text-gray-400 hover:text-white transition-all" title="Push to Back"><ChevronFirst size={14}/></button>
              <button onClick={() => onUpdate({zIndex: maxZ + 1})} className="flex-1 bg-[#111] p-2 rounded border border-[#333] hover:border-yellow-500 flex justify-center text-gray-400 hover:text-white transition-all" title="Bring to Top"><ChevronLast size={14}/></button>
              <button onClick={() => onUpdate({flipX: !layer.flipX})} className={`flex-[2] p-2 rounded text-[9px] font-black uppercase transition-all ${layer.flipX ? 'bg-yellow-600 text-white' : 'bg-[#111] border border-[#333] text-gray-400 hover:text-white'}`}>FLIP ASSET</button>
          </div>
      </div>
    </div>
  );
};

export default App;
