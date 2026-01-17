
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
  FileImage, Frame, Wand, Send, Zap
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

const STORAGE_KEY = 'comiccraft_current_project';

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
  // Load from localStorage on init
  const [project, setProject] = useState<ComicProject>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_PROJECT;
  });
  
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showTextWindow, setShowTextWindow] = useState(false);
  const [showPresetsWindow, setShowPresetsWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isExporting, setIsExporting] = useState(false);
  const [aiActionLabel, setAiActionLabel] = useState<string>('Processing...');
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'global' | 'panel' | 'layer-sidebar', panelId?: string, layerId?: string } | null>(null);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

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
      panels: prev.panels.map(p => {
        if (p.id === panelId) {
          return {
            ...p,
            layers: p.layers.map(l => l.id === layerId ? { ...l, ...updates } : l)
          };
        }
        return p;
      })
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

  // Fix: Add missing removeSelectedLayer function to handle layer deletion from context menu
  const removeSelectedLayer = () => {
    if (!selectedPanelId || !selectedLayerId) return;
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => {
        if (p.id === selectedPanelId) {
          return { ...p, layers: p.layers.filter(l => l.id !== selectedLayerId) };
        }
        return p;
      })
    }));
    setSelectedLayerId(null);
    setContextMenu(null);
  };

  // Fix: Add missing acceptGeneration function to insert generated AI assets into the target panel
  const acceptGeneration = () => {
    if (!aiPreview || !targetPanelId) return;
    
    const panel = project.panels.find(p => p.id === targetPanelId);
    if (!panel) return;

    const newLayer: Layer = {
      id: `l${Date.now()}`,
      type: aiSettings.targetType === 'background' ? LayerType.BACKGROUND : LayerType.CHARACTER,
      name: `${aiSettings.targetType === 'background' ? 'Background' : 'Character'} ${Date.now().toString().slice(-4)}`,
      content: aiPreview,
      originalContent: originalPreview || undefined,
      hasBackgroundRemoved: aiSettings.removeBackground && aiSettings.targetType === 'character',
      x: 50,
      y: 50,
      scale: aiSettings.targetType === 'background' ? 1 : 0.5,
      rotation: 0,
      opacity: 1,
      zIndex: panel.layers.length + 1
    };

    updatePanel(targetPanelId, { layers: [...panel.layers, newLayer] });
    setAiPreview(null);
    setOriginalPreview(null);
    setShowAIWindow(false);
    setSelectedPanelId(targetPanelId);
    setSelectedLayerId(newLayer.id);
    
    // Maintain prompt history
    if (prompt && !promptHistory.includes(prompt)) {
      const newHistory = [prompt, ...promptHistory.slice(0, 19)];
      setPromptHistory(newHistory);
      localStorage.setItem('comiccraft_prompts', JSON.stringify(newHistory));
    }
  };

  // Fix: Add missing addTextBubble function to create new speech, thought, or shout bubbles
  const addTextBubble = (type: 'speech' | 'thought' | 'shout') => {
    const targetId = selectedPanelId || (project.panels.length > 0 ? project.panels[0].id : null);
    if (!targetId) return;
    
    const panel = project.panels.find(p => p.id === targetId);
    if (!panel) return;

    const newLayer: Layer = {
      id: `l${Date.now()}`,
      type: LayerType.TEXT_BUBBLE,
      name: `Bubble ${Date.now().toString().slice(-4)}`,
      content: 'New Dialogue',
      bubbleType: type,
      x: 50,
      y: 50,
      scale: 0.3,
      rotation: 0,
      opacity: 1,
      zIndex: panel.layers.length + 1,
      fontSize: 24,
      tailX: 20,
      tailY: 85
    };

    updatePanel(targetId, { layers: [...panel.layers, newLayer] });
    setSelectedPanelId(targetId);
    setSelectedLayerId(newLayer.id);
    setShowTextWindow(false);
  };

  const handleGenerateImage = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setAiActionLabel('Visualizing Prompt...');
    setLastError(null);
    setOriginalPreview(null);
    try {
      const enhanced = await enhancePrompt(prompt);
      const img = await generateImage(enhanced);
      setOriginalPreview(img);
      if (aiSettings.targetType === 'character' && aiSettings.removeBackground) {
        setAiActionLabel('Magic Extracting Subject...');
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

  const handlePropertyBGAction = async (panelId: string, layerId: string, action: 'remove' | 'restore' | 'extract') => {
    const panel = project.panels.find(p => p.id === panelId);
    const layer = panel?.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    setIsGenerating(true);
    setAiActionLabel(action === 'extract' ? 'Isolating Subject...' : 'Clearing Background...');
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

  const savePageAsPNG = async () => {
    if (!workspaceRef.current) return;
    setIsExporting(true);
    setContextMenu(null);
    
    const originalSelectedPanel = selectedPanelId;
    const originalSelectedLayer = selectedLayerId;
    setSelectedPanelId(null);
    setSelectedLayerId(null);
    
    try {
      const canvas = await html2canvas(workspaceRef.current, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2, 
        width: project.width,
        height: project.height,
        logging: false,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('.export-target') as HTMLElement;
          if (el) el.style.transform = 'none';
        }
      });
      
      const link = document.createElement('a');
      link.download = `${project.title.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error("Export error:", err);
      alert("PNG Export failed. High DPI capture might be too large for this browser's memory.");
    } finally {
      setIsExporting(false);
      setSelectedPanelId(originalSelectedPanel);
      setSelectedLayerId(originalSelectedLayer);
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
        scale: 3, // Even higher DPI for individual panels
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Panel_${panelId.slice(-4)}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error("Panel export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}.json`;
    a.click();
    setContextMenu(null);
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
        alert("Corrupted or invalid JSON project file.");
      }
    };
    reader.readAsText(file);
    setContextMenu(null);
  };

  return (
    <div 
      className="flex h-screen w-screen bg-[#121212] select-none overflow-hidden text-gray-200"
      onContextMenu={handleGlobalContextMenu}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={loadProject} />
      
      {/* Sidebar Navigation */}
      <div className={`${isMobile ? 'w-12' : 'w-16'} bg-[#1a1a1a] border-r border-[#333] flex flex-col items-center py-4 gap-6 z-[100] shadow-2xl`} onContextMenu={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl comic-font shadow-lg transform hover:scale-105 active:scale-95 transition-all">C</div>
        <div className="flex flex-col gap-2">
          <ToolbarButton icon={<Plus size={isMobile ? 20 : 24} />} label="Add Panel" onClick={addPanel} />
          <ToolbarButton icon={<Grid3X3 size={isMobile ? 20 : 24} />} label="Layout Presets" onClick={() => setShowPresetsWindow(true)} />
          <ToolbarButton icon={<Type size={isMobile ? 20 : 24} />} label="Dialogue" onClick={() => setShowTextWindow(true)} />
          <ToolbarButton icon={<Wand2 size={isMobile ? 20 : 24} />} label="AI Canvas" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
        </div>
        <div className="mt-auto flex flex-col gap-4 mb-4 text-gray-500">
          <ToolbarButton icon={<FileImage size={20} />} label="Quick PNG" onClick={savePageAsPNG} />
          <ToolbarButton icon={<Download size={20} />} label="Export JSON" onClick={downloadProject} />
          <ToolbarButton icon={<Settings size={20} />} label="Project Settings" onClick={() => setShowSettingsWindow(true)} />
        </div>
      </div>

      {/* Main Workspace */}
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
            transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
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
              className={`absolute cursor-move touch-none overflow-hidden transition-shadow ${selectedPanelId === panel.id ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-white' : ''}`}
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
                  className={`absolute pointer-events-auto cursor-pointer ${selectedLayerId === layer.id ? 'ring-2 ring-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : ''}`}
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

        {/* Status & Tooltips */}
        <div className="absolute top-6 left-6 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-[10px] font-black tracking-widest uppercase text-white/70">{project.title}</span>
           <div className="w-px h-3 bg-white/20"></div>
           <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">PRO BUILD V1.0</span>
        </div>

        {/* Zoom & Navigation Control */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#333] rounded-full p-1.5 flex items-center gap-2 shadow-2xl z-50 scale-75 md:scale-100" onContextMenu={e => e.stopPropagation()}>
          <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="p-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white transition-colors">
            <ZoomOut size={18} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <span className="text-[10px] font-mono font-black text-white w-12 text-center">{Math.round(project.zoom * 100)}%</span>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => setProject(p => ({...p, zoom: Math.min(2, p.zoom + 0.1)}))} className="p-2 hover:bg-[#333] rounded-full text-gray-400 hover:text-white transition-colors">
            <ZoomIn size={18} />
          </button>
        </div>

        {/* Production Overlays */}
        {isExporting && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[5000] backdrop-blur-xl animate-in fade-in duration-300">
             <div className="flex flex-col items-center gap-6">
                <div className="relative">
                   <RefreshCw className="animate-spin text-indigo-500" size={64} />
                   <div className="absolute inset-0 flex items-center justify-center"><Zap size={24} className="text-white animate-pulse"/></div>
                </div>
                <div className="text-center space-y-2">
                   <span className="text-2xl font-black comic-font tracking-[0.2em] text-white animate-pulse">EXPORTING HIGH-DPI ART...</span>
                   <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest opacity-60">Serializing Canvas Layers & Base64 Data</p>
                </div>
             </div>
          </div>
        )}

        {isGenerating && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[4500] backdrop-blur-[4px] animate-in fade-in">
             <div className="bg-[#1a1a1a] border border-[#333] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 scale-90 md:scale-100">
                <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                  <Wand2 className="animate-bounce text-indigo-400" size={32} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black tracking-widest text-white uppercase italic block">{aiActionLabel}</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">Consulting Gemini Flash-2.5</span>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Layers and Properties */}
      {(showLayers || showProperties) && (
        <div className="w-80 bg-[#1a1a1a] border-l border-[#333] flex flex-col h-full z-50 overflow-y-auto custom-scrollbar hidden lg:flex shadow-2xl" onContextMenu={e => e.stopPropagation()}>
          <CollapsiblePanel title="Scene Explorer" icon={<Layers size={14} />} isOpen={showLayers} onToggle={() => setShowLayers(!showLayers)}>
            <div className="p-3 space-y-3">
              {project.panels.length === 0 && <div className="text-center py-10 text-[9px] font-bold uppercase text-gray-600">No Panels Found</div>}
              {project.panels.map(panel => (
                <div key={panel.id} className={`p-2 rounded-xl border transition-all ${selectedPanelId === panel.id ? 'bg-indigo-900/10 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-black/20 border-[#333]'}`}>
                  <div className="text-[10px] font-black uppercase mb-2 flex justify-between items-center px-1">
                    <span className={selectedPanelId === panel.id ? 'text-indigo-400' : 'text-gray-500'}>Panel {panel.id.slice(-4)}</span>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setContextMenu({x: e.clientX, y: e.clientY, type: 'panel', panelId: panel.id}) }} className="hover:text-white transition-colors"><MenuIcon size={12}/></button>
                  </div>
                  <div className="space-y-1">
                    {panel.layers.length === 0 && <div className="text-[8px] italic text-gray-600 text-center py-2">No Layers</div>}
                    {[...panel.layers].reverse().map(l => (
                      <div 
                        key={l.id} 
                        className={`group flex items-center justify-between text-[9px] p-2 rounded-lg transition-all select-none border border-transparent ${selectedLayerId === l.id ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'text-gray-400 cursor-pointer hover:bg-white/5'}`} 
                        onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(l.id); }}
                        onContextMenu={(e) => handleLayerSidebarContextMenu(e, panel.id, l.id)}
                      >
                        <div className="flex items-center gap-2 truncate">
                           <div className={`w-1 h-1 rounded-full ${selectedLayerId === l.id ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
                           <span className="truncate">{l.name}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                           <button onClick={(e) => { e.stopPropagation(); duplicateLayer(panel.id, l.id); }} className="p-1 hover:text-white"><Copy size={10}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel title="Contextual Controls" icon={<Settings size={14} />} isOpen={showProperties} onToggle={() => setShowProperties(!showProperties)}>
            <div className="p-4 space-y-6">
              {currentLayer ? (
                <div className="space-y-4">
                  <LayerProperties layer={currentLayer} onUpdate={(u) => updateLayer(selectedPanelId!, selectedLayerId!, u)} allLayers={currentPanel?.layers || []} />
                  {(currentLayer.type === LayerType.CHARACTER || currentLayer.type === LayerType.ASSET || currentLayer.type === LayerType.BACKGROUND) && (
                    <div className="pt-4 border-t border-[#333] space-y-3">
                      <label className="text-[10px] font-bold uppercase text-indigo-400 tracking-widest">AI POST-PROCESSING</label>
                      <div className="grid grid-cols-2 gap-2">
                        {!currentLayer.hasBackgroundRemoved ? (
                          <>
                            <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'remove')} className="bg-indigo-600/10 border border-indigo-500/30 p-2.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-600/20 transition-all text-indigo-400"><Eraser size={12}/> CLEAR BG</button>
                            <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'extract')} className="bg-yellow-600/10 border border-yellow-500/30 p-2.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-yellow-600/20 transition-all text-yellow-500"><Wand size={12}/> MAGIC CUT</button>
                          </>
                        ) : (
                          <button onClick={() => handlePropertyBGAction(selectedPanelId!, selectedLayerId!, 'restore')} className="col-span-2 bg-[#222] border border-[#333] p-2.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-[#333] transition-all"><RefreshCw size={12}/> REVERT TO SOURCE</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : currentPanel ? (
                <PanelProperties panel={currentPanel} onUpdate={(u) => updatePanel(selectedPanelId!, u)} />
              ) : <div className="text-center text-[10px] text-gray-500 py-16 uppercase font-black opacity-30 italic">Select an object to edit</div>}
            </div>
          </CollapsiblePanel>
        </div>
      )}

      {/* Dynamic Context Menus */}
      {contextMenu && (
        <div 
          className="fixed bg-[#1a1a1a] border border-[#333] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl z-[2000] overflow-hidden w-64 flex flex-col animate-in fade-in zoom-in duration-150 p-1.5"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={e => e.stopPropagation()}
        >
          {contextMenu.type === 'panel' ? (
            <>
              <div className="p-3 mb-1 text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/5 rounded-xl border border-indigo-500/10">PANEL ID: {contextMenu.panelId?.slice(-4)}</div>
              <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiSettings(s => ({...s, targetType: 'character'})); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-xl text-left font-bold transition-all"><UserIcon size={14}/> Generate Character</button>
              <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiSettings(s => ({...s, targetType: 'background'})); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-xl text-left font-bold transition-all"><Mountain size={14}/> Generate Background</button>
              <div className="h-px bg-[#333] my-1 mx-2"></div>
              <button onClick={() => savePanelAsPNG(contextMenu.panelId!)} className="flex items-center gap-3 p-3 text-xs hover:bg-white/5 rounded-xl text-left font-bold transition-all"><Frame size={14}/> Save Panel as PNG</button>
              <div className="h-px bg-[#333] my-1 mx-2"></div>
              <button onClick={() => { setProject(p => ({...p, panels: p.panels.filter(pan => pan.id !== contextMenu.panelId)})); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-red-600/20 rounded-xl transition-all text-left font-bold text-red-400"><XCircle size={14}/> Delete Panel</button>
            </>
          ) : contextMenu.type === 'layer-sidebar' ? (
            <>
              <div className="p-3 mb-1 text-[9px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/5 rounded-xl border border-yellow-500/10">LAYER OPERATIONS</div>
              <button onClick={() => duplicateLayer(contextMenu.panelId!, contextMenu.layerId!)} className="flex items-center gap-3 p-3 text-xs hover:bg-yellow-600/10 rounded-xl text-left font-bold transition-all"><Copy size={14}/> Duplicate Asset</button>
              
              <div className="p-2.5 mt-2 text-[8px] font-black uppercase tracking-widest text-gray-500 opacity-50">RELOCATE TO PANEL</div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar px-1">
                {project.panels.map(p => (
                  <button 
                    key={p.id} 
                    disabled={p.id === contextMenu.panelId}
                    onClick={() => sendLayerToPanel(contextMenu.panelId!, contextMenu.layerId!, p.id)}
                    className={`w-full flex items-center gap-3 p-2.5 text-[10px] hover:bg-indigo-600/20 rounded-lg text-left font-bold transition-all mb-0.5 ${p.id === contextMenu.panelId ? 'opacity-20 cursor-not-allowed' : ''}`}
                  >
                    <Send size={12}/> Panel {p.id.slice(-4)}
                  </button>
                ))}
              </div>
              <div className="h-px bg-[#333] my-1 mx-2"></div>
              <button onClick={removeSelectedLayer} className="flex items-center gap-3 p-3 text-xs hover:bg-red-600/20 rounded-xl text-red-400 text-left font-bold transition-all"><Trash2 size={14}/> Remove Layer</button>
            </>
          ) : (
            <>
              <div className="p-3 mb-1 text-[9px] font-black uppercase tracking-widest text-gray-500 bg-white/5 rounded-xl border border-white/10">PROJECT MENU</div>
              <button onClick={addPanel} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-xl text-left font-bold transition-all"><Plus size={14}/> New Panel</button>
              <button onClick={() => setShowPresetsWindow(true)} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-xl text-left font-bold transition-all"><Layout size={14}/> Choose Layout</button>
              <div className="h-px bg-[#333] my-1 mx-2"></div>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 text-xs hover:bg-white/5 rounded-xl text-left font-bold transition-all"><Upload size={14}/> Import Project</button>
              <button onClick={downloadProject} className="flex items-center gap-3 p-3 text-xs hover:bg-white/5 rounded-xl text-left font-bold transition-all"><Save size={14}/> Save JSON Backup</button>
              <div className="h-px bg-[#333] my-1 mx-2"></div>
              <button onClick={savePageAsPNG} className="flex items-center gap-3 p-3 text-xs hover:bg-green-600/20 rounded-xl text-green-400 text-left font-black transition-all"><FileImage size={14}/> GENERATE FINAL PNG</button>
            </>
          )}
        </div>
      )}

      {/* Floating Modal Windows */}
      {showAIWindow && (
        <FloatingWindow title="AI ART STUDIO" onClose={() => setShowAIWindow(false)} width={isMobile ? 'w-[90vw]' : 'w-[500px]'}>
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-600 tracking-widest">TARGET PANEL</label>
                <select className="w-full bg-black border border-white/10 p-2.5 rounded-xl text-[10px] font-black text-indigo-400 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer" value={targetPanelId || ''} onChange={(e) => setTargetPanelId(e.target.value)}>
                  {project.panels.map(p => <option key={p.id} value={p.id}>PANEL {p.id.slice(-4)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-600 tracking-widest">ASSET TYPE</label>
                <div className="flex bg-black p-1 rounded-xl border border-white/10 h-10">
                  <button onClick={() => setAiSettings({...aiSettings, targetType: 'background'})} className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${aiSettings.targetType === 'background' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-gray-300'}`}>BG</button>
                  <button onClick={() => setAiSettings({...aiSettings, targetType: 'character'})} className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${aiSettings.targetType === 'character' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-gray-300'}`}>HERO</button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <textarea 
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm h-36 focus:border-indigo-500 outline-none font-bold placeholder:text-gray-700 transition-all shadow-inner" 
                placeholder="Ex: Cyberpunk samurai standing in neon rain, dynamic manga perspective, cell shaded..." 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
              />
              {promptHistory.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                   {promptHistory.slice(0, 5).map((h, i) => (
                     <button key={i} onClick={() => setPrompt(h)} className="text-[8px] bg-black border border-white/5 px-3 py-1.5 rounded-full text-gray-500 hover:text-indigo-400 hover:border-indigo-500 transition-all truncate max-w-[150px] font-bold uppercase">{h}</button>
                   ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button onClick={async () => { setAiActionLabel('Analyzing Intent...'); setPrompt(await enhancePrompt(prompt)); }} className="bg-[#222] px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-[#333] transition-all"><Sparkles size={14}/> ENHANCE</button>
              <button onClick={handleGenerateImage} disabled={isGenerating || !prompt} className="flex-1 bg-indigo-600 px-4 py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                {isGenerating ? <RefreshCw className="animate-spin" size={16}/> : <ImageIcon size={16}/>} DRAW ASSET
              </button>
            </div>

            {aiPreview && (
              <div className="pt-4 mt-2 border-t border-white/10 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                <div className="dark-transparency-grid rounded-2xl border border-white/10 overflow-hidden aspect-video relative flex items-center justify-center bg-black/40 shadow-2xl">
                  <img src={aiPreview} className="max-w-full max-h-full object-contain" alt="preview" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setAiPreview(null); setOriginalPreview(null); }} className="flex-1 bg-[#222] py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-900/20 hover:text-red-400 transition-all">DISCARD</button>
                  <button onClick={acceptGeneration} className="flex-[2] bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shadow-xl">PLACE IN PANEL {targetPanelId?.slice(-4)}</button>
                </div>
              </div>
            )}
          </div>
        </FloatingWindow>
      )}

      {/* Global Presets */}
      {showPresetsWindow && (
        <FloatingWindow title="PAGE DIMENSIONS" onClose={() => setShowPresetsWindow(false)} width="w-80">
          <div className="space-y-3 p-1">
            {Object.entries(PAGE_PRESETS).map(([key, value]) => (
              <button key={key} onClick={() => applyLayoutPreset(key as keyof typeof PAGE_PRESETS)} className="w-full bg-black/40 hover:bg-indigo-900/10 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group transition-all">
                <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center group-hover:bg-indigo-600 transition-all shadow-inner border border-white/5"><Layout size={24} className="text-gray-600 group-hover:text-white" /></div>
                <div className="text-left">
                  <div className="text-[11px] font-black uppercase tracking-widest text-white/90">{value.name}</div>
                  <div className="text-[9px] text-indigo-400 font-mono font-bold mt-1 opacity-60">{value.width} x {value.height} PIXELS</div>
                </div>
              </button>
            ))}
          </div>
        </FloatingWindow>
      )}

      {/* Settings & Credits */}
      {showSettingsWindow && (
        <FloatingWindow title="STUDIO PREFERENCES" onClose={() => setShowSettingsWindow(false)} width="w-80">
          <div className="space-y-6 p-2">
            <div className="space-y-3">
               <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest px-1">PROJECT IDENTITY</label>
               <div className="space-y-2">
                  <input type="text" placeholder="Project Title" value={project.title} onChange={e => setProject({...project, title: e.target.value})} className="w-full bg-black px-4 py-3 rounded-xl border border-white/10 text-xs font-bold focus:border-indigo-500 transition-all" />
                  <input type="text" placeholder="Author Name" value={project.author} onChange={e => setProject({...project, author: e.target.value})} className="w-full bg-black px-4 py-3 rounded-xl border border-white/10 text-xs font-bold focus:border-indigo-500 transition-all" />
               </div>
            </div>
            <div className="bg-indigo-600/5 border border-indigo-500/10 p-4 rounded-2xl">
               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Production Tip</span>
               <p className="text-[9px] text-gray-500 mt-2 font-bold leading-relaxed">Generated high-DPI comics are saved directly to your browser's local storage. Export a JSON backup periodically to ensure your work is safe across devices.</p>
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* Bubble Menu */}
      {showTextWindow && (
        <FloatingWindow title="DIALOGUE LIBRARY" onClose={() => setShowTextWindow(false)} width="w-72">
          <div className="space-y-3">
            <button onClick={() => addTextBubble('speech')} className="w-full bg-black/40 hover:bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4 group transition-all"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg"><Square size={20} color="black" fill="black"/></div><span className="text-xs font-black uppercase tracking-widest">Normal Speech</span></button>
            <button onClick={() => addTextBubble('thought')} className="w-full bg-black/40 hover:bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4 group transition-all"><div className="w-10 h-10 bg-white/40 rounded-xl flex items-center justify-center shadow-lg"><Square size={20} color="black"/></div><span className="text-xs font-black uppercase tracking-widest">Thought Cloud</span></button>
            <button onClick={() => addTextBubble('shout')} className="w-full bg-black/40 hover:bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4 group transition-all"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center -rotate-12 shadow-lg scale-110"><Square size={20} color="black" fill="black"/></div><span className="text-xs font-black uppercase tracking-widest italic">Action Shout</span></button>
          </div>
        </FloatingWindow>
      )}
    </div>
  );
};

// Internal Atomic Components
const ToolbarButton = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3.5 rounded-xl group relative transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'hover:bg-white/5 text-gray-500 hover:text-gray-200'}`}>
    {icon}
    <span className="absolute left-full ml-3 bg-[#1a1a1a] p-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap hidden group-hover:block z-[200] border border-[#333] shadow-2xl animate-in fade-in slide-in-from-left-2">{label}</span>
  </button>
);

const CollapsiblePanel = ({ title, icon, children, isOpen, onToggle }: any) => (
  <div className={`flex flex-col border-b border-white/5 ${!isOpen ? 'h-12 flex-none' : 'flex-1 min-h-0'}`}>
    <div className="p-4 bg-[#1a1a1a] flex justify-between items-center cursor-pointer transition-colors hover:bg-white/5" onClick={onToggle}>
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/80">{icon} {title}</div>
      <div className="text-gray-600">{isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>
    </div>
    <div className={`overflow-y-auto custom-scrollbar transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
       {isOpen && children}
    </div>
  </div>
);

const PanelProperties = ({ panel, onUpdate }: any) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 p-1">
      <div className="text-[10px] font-black uppercase text-indigo-400 border-b border-indigo-500/20 pb-3 flex items-center gap-2 tracking-[0.2em]"><Layout size={12}/> FRAME GEOMETRY</div>
      <div className="space-y-6">
        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest block opacity-60">Canvas Bounding Box</label>
        <div className="space-y-5">
          <div className="space-y-2 px-1">
             <div className="flex justify-between text-[8px] font-black font-mono tracking-tighter"><span className="text-gray-600">WIDTH</span> <span className="text-indigo-400">{panel.width}PX</span></div>
             <input type="range" min="100" max="1200" value={panel.width} onChange={e => onUpdate({width: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded-full appearance-none cursor-ew-resize" />
          </div>
          <div className="space-y-2 px-1">
             <div className="flex justify-between text-[8px] font-black font-mono tracking-tighter"><span className="text-gray-600">HEIGHT</span> <span className="text-indigo-400">{panel.height}PX</span></div>
             <input type="range" min="100" max="1800" value={panel.height} onChange={e => onUpdate({height: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded-full appearance-none cursor-ew-resize" />
          </div>
        </div>
      </div>
      <div className="flex justify-center bg-black/40 rounded-3xl p-6 border border-white/5"><Knob label="Canvas Rotation" value={panel.rotation} onChange={(val) => onUpdate({ rotation: val })} /></div>
      <div className="space-y-4 px-1">
        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest flex justify-between">Outline Weight <span>{panel.borderThickness}PX</span></label>
        <input type="range" min="0" max="40" value={panel.borderThickness} onChange={e => onUpdate({borderThickness: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded-full appearance-none" />
      </div>
      <div className="space-y-4 px-1">
        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest flex justify-between">Drop Shadow <span>{panel.shadowIntensity}PX</span></label>
        <input type="range" min="0" max="50" value={panel.shadowIntensity} onChange={e => onUpdate({shadowIntensity: +e.target.value})} className="w-full h-1 accent-indigo-500 bg-[#333] rounded-full appearance-none" />
      </div>
    </div>
  );
};

const LayerProperties = ({ layer, onUpdate, allLayers }: any) => {
  const maxZ = allLayers.length > 0 ? Math.max(...allLayers.map((l: any) => l.zIndex)) : 0;
  const minZ = allLayers.length > 0 ? Math.min(...allLayers.map((l: any) => l.zIndex)) : 0;
  return (
    <div className="space-y-8 animate-in fade-in duration-300 p-1">
      <div className="text-[10px] font-black uppercase text-yellow-500 border-b border-yellow-500/20 pb-3 flex items-center gap-2 tracking-[0.2em]"><Layers size={12}/> ASSET ATTRIBUTES</div>
      {layer.type === LayerType.TEXT_BUBBLE && (
        <div className="space-y-3">
           <label className="text-[9px] text-gray-600 uppercase font-black tracking-widest px-1">SCRIPT TEXT</label>
           <textarea value={layer.content} onChange={e => onUpdate({content: e.target.value})} className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[13px] font-black h-24 outline-none focus:border-yellow-500 transition-all shadow-inner leading-relaxed" />
        </div>
      )}
      <div className="space-y-6 px-1">
        <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest block opacity-60">Visual Scaling</label>
        <div className="space-y-5">
          <div className="space-y-2">
             <div className="flex justify-between text-[8px] font-black font-mono tracking-tighter"><span className="text-gray-600">SCALE</span> <span className="text-yellow-500">{layer.scale.toFixed(2)}X</span></div>
             <input type="range" min="0.1" max="5" step="0.05" value={layer.scale} onChange={e => onUpdate({scale: +e.target.value})} className="w-full h-1 accent-yellow-500 bg-[#333] rounded-full appearance-none cursor-ew-resize" />
          </div>
          <div className="space-y-2">
             <div className="flex justify-between text-[8px] font-black font-mono tracking-tighter"><span className="text-gray-600">ALPHA</span> <span className="text-yellow-500">{Math.round(layer.opacity * 100)}%</span></div>
             <input type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={e => onUpdate({opacity: +e.target.value})} className="w-full h-1 accent-yellow-500 bg-[#333] rounded-full appearance-none cursor-ew-resize" />
          </div>
        </div>
      </div>
      <div className="flex justify-center bg-black/40 rounded-3xl p-6 border border-white/5"><Knob label="Rotation" value={layer.rotation} onChange={(val) => onUpdate({ rotation: val })} /></div>
      <div className="space-y-3">
          <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest px-1">Layer Ordering</label>
          <div className="flex gap-2">
              <button onClick={() => onUpdate({zIndex: minZ - 1})} className="flex-1 bg-black/40 p-3 rounded-xl border border-white/10 hover:border-yellow-500/50 flex justify-center text-gray-500 hover:text-white transition-all" title="Push to Back"><ChevronFirst size={16}/></button>
              <button onClick={() => onUpdate({zIndex: maxZ + 1})} className="flex-1 bg-black/40 p-3 rounded-xl border border-white/10 hover:border-yellow-500/50 flex justify-center text-gray-500 hover:text-white transition-all" title="Bring to Top"><ChevronLast size={16}/></button>
              <button onClick={() => onUpdate({flipX: !layer.flipX})} className={`flex-[2] py-3 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${layer.flipX ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20' : 'bg-black/40 border border-white/10 text-gray-500 hover:text-white'}`}>FLIP ASSET</button>
          </div>
      </div>
    </div>
  );
};

export default App;
