
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Type, Square, Layout, ZoomIn, ZoomOut, Grid3X3,
  Mountain, User as UserIcon, Sparkles, 
  XCircle, FileImage, Cpu, Globe, Zap, RefreshCw, 
  CheckCircle2, AlertCircle, FolderOpen, HardDrive, Trash2,
  FileJson, FileText, Upload, ChevronUp, ChevronDown, Move, Eye, EyeOff,
  MessageSquare, MousePointer2, Box, File, Edit3, Smile, Info, Maximize, RotateCw
} from 'lucide-react';
import { ComicProject, Panel, Layer, LayerType, AISettings, AIBackend } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import * as aiService from './services/aiService';
import html2canvas from 'html2canvas';

// Separate Page (Canvas) Dimensions
const CANVAS_PRESETS = {
  GOLDEN_AGE: { width: 1200, height: 1800, name: 'Golden Age Comic', category: 'Standard' },
  MANGA: { width: 1000, height: 1500, name: 'Tankobon / Manga', category: 'Standard' },
  WIDESCREEN: { width: 1920, height: 1080, name: 'Cinematic / HD', category: 'Screen' },
  SQUARE: { width: 1080, height: 1080, name: 'Social / Instagram', category: 'Modern' },
  A4: { width: 2480, height: 3508, name: 'Print A4 (300DPI)', category: 'Print' },
};

// Separate Panel Arrangement Templates
const PANEL_LAYOUTS = {
  GRID_6: {
    name: 'Traditional 6-Grid',
    panels: [
      { x: 50, y: 50, w: 0.45, h: 0.3 }, { x: 0.55, y: 50, w: 0.45, h: 0.3 },
      { x: 50, y: 0.35, w: 0.45, h: 0.3 }, { x: 0.55, y: 0.35, w: 0.45, h: 0.3 },
      { x: 50, y: 0.65, w: 0.45, h: 0.3 }, { x: 0.55, y: 0.65, w: 0.45, h: 0.3 }
    ]
  },
  SPLASH_TOP: {
    name: 'Action Splash',
    panels: [
      { x: 50, y: 50, w: 0.9, h: 0.5 },
      { x: 50, y: 0.58, w: 0.28, h: 0.37 }, { x: 0.34, y: 0.58, w: 0.28, h: 0.37 }, { x: 0.63, y: 0.58, w: 0.28, h: 0.37 }
    ]
  },
  CINEMATIC: {
    name: 'Cinematic Duo',
    panels: [
      { x: 50, y: 50, w: 0.92, h: 0.45 },
      { x: 50, y: 0.52, w: 0.92, h: 0.45 }
    ]
  }
};

const STORAGE_KEY = 'comiccraft_studio_v15_stable';

const App: React.FC = () => {
  const [project, setProject] = useState<ComicProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { id: '1', title: 'New Comic', author: 'Artist', panels: [], width: 1200, height: 1800, zoom: 0.4 };
    } catch {
      return { id: '1', title: 'New Comic', author: 'Artist', panels: [], width: 1200, height: 1800, zoom: 0.4 };
    }
  });

  const [aiSettings, setAiSettings] = useState<AISettings>({
    backend: 'gemini', endpoint: 'http://127.0.0.1:7860', apiKey: '', model: '', steps: 25, cfgScale: 7, sampler: 'Euler a', removeBackground: true, bgRemovalEngine: 'gemini', loras: [], checkpointFolderPath: '', loraFolderPath: ''
  });

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);
  const [showCanvasWindow, setShowCanvasWindow] = useState(false);
  const [showLayoutWindow, setShowLayoutWindow] = useState(false);
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiAssetType, setAiAssetType] = useState<'character' | 'background'>('character');
  const [statusMessage, setStatusMessage] = useState("Ready for a masterpiece.");
  const [tooltip, setTooltip] = useState('Select an element from the Layer Panel to edit.');

  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);

  // --- Logic Functions ---

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...updates } : p) }));
  }, []);

  const updateLayer = useCallback((pId: string, lId: string, updates: Partial<Layer>) => {
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === pId ? { ...p, layers: p.layers.map(l => l.id === lId ? { ...l, ...updates } : l) } : p)
    }));
  }, []);

  const addPanel = useCallback((custom: Partial<Panel> = {}) => {
    const id = `p${Math.random().toString(36).substr(2, 9)}`;
    const newPanel: Panel = {
      id, title: custom.title || `Panel ${project.panels.length + 1}`, x: custom.x || 100, y: custom.y || 100, 
      width: custom.width || 400, height: custom.height || 300, rotation: 0, zIndex: project.panels.length + 1,
      borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4,
      backgroundColor: '#ffffff', layers: []
    };
    setProject(prev => ({ ...prev, panels: [...prev.panels, newPanel] }));
    setSelectedPanelId(id);
    setSelectedLayerId(null);
  }, [project.panels.length]);

  const applyLayout = (layoutKey: keyof typeof PANEL_LAYOUTS) => {
    const layout = PANEL_LAYOUTS[layoutKey];
    const newPanels: Panel[] = layout.panels.map((p, i) => ({
      id: `p_lay_${Date.now()}_${i}`,
      title: `Panel ${i + 1}`,
      x: p.x === 50 ? (project.width / 2) - ((project.width * p.w) / 2) : (project.width * p.x), // Crude positioning for demo
      y: p.y === 50 ? (project.height / 2) - ((project.height * p.h) / 2) : (project.height * p.y),
      width: project.width * p.w,
      height: project.height * p.h,
      rotation: 0,
      zIndex: i + 1,
      borderThickness: 4,
      borderColor: '#000000',
      borderOpacity: 1,
      shadowIntensity: 4,
      backgroundColor: '#ffffff',
      layers: []
    }));
    // Simplified centering logic
    const centeredPanels = newPanels.map(p => ({
      ...p,
      x: (project.width - p.width) / 2, // Re-center based on template needs usually
    }));

    setProject(prev => ({ ...prev, panels: newPanels }));
    setShowLayoutWindow(false);
    setStatusMessage(`Applied ${layout.name} arrangement.`);
  };

  const exportPNG = async () => {
    if (!workspaceRef.current) return;
    setIsExporting(true);
    const originalZoom = project.zoom;
    setProject(prev => ({ ...prev, zoom: 1 }));
    await new Promise(r => setTimeout(r, 500));
    try {
      const canvas = await html2canvas(workspaceRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${project.title}_export.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatusMessage("Exported to PNG.");
    } catch { setStatusMessage("Export failed."); }
    setProject(prev => ({ ...prev, zoom: originalZoom }));
    setIsExporting(false);
  };

  const handleAIProduction = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const finalPrompt = await aiService.enhancePrompt(prompt);
      let img = await aiService.generateImage(finalPrompt, aiSettings);
      if (aiAssetType === 'character' && aiSettings.removeBackground) {
        img = await aiService.removeBackground(img, aiSettings);
      }
      setAiPreview(img);
    } catch (e: any) { alert(e.message); }
    finally { setIsGenerating(false); }
  };

  const selectedPanel = project.panels.find(p => p.id === selectedPanelId);
  const selectedLayer = selectedPanel?.layers.find(l => l.id === selectedLayerId);

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] select-none overflow-hidden text-gray-200 font-sans flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Toolbar */}
        <div className="w-16 bg-[#161616] border-r border-white/5 flex flex-col items-center py-6 gap-6 z-[100] shadow-2xl">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-black comic-font text-2xl shadow-lg cursor-pointer">C</div>
          
          <ToolbarBtn icon={<Plus size={20}/>} label="Add Panel" onClick={() => addPanel()} onMouseEnter={() => setTooltip("Manually place a new panel")} />
          <ToolbarBtn icon={<Layout size={20}/>} label="Canvas Size" onClick={() => setShowCanvasWindow(true)} active={showCanvasWindow} />
          <ToolbarBtn icon={<Grid3X3 size={20}/>} label="Panel Layouts" onClick={() => setShowLayoutWindow(true)} active={showLayoutWindow} />
          <ToolbarBtn icon={<Wand2 size={20}/>} label="AI Creator" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
          
          <div className="h-px w-8 bg-white/10" />
          
          <ToolbarBtn icon={<FileJson size={20}/>} label="Export Project" onClick={() => {}} />
          <ToolbarBtn icon={<Upload size={20}/>} label="Open Project" onClick={() => {}} />
          
          <div className="mt-auto flex flex-col gap-4 mb-4">
             <ToolbarBtn icon={<FileImage size={20}/>} label="Export PNG" onClick={exportPNG} />
             <ToolbarBtn icon={<Settings size={20}/>} label="Pipeline" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
          </div>
        </div>

        {/* Workspace Canvas */}
        <div className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-auto custom-scrollbar" onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); }}>
          <div 
            ref={workspaceRef} 
            className="bg-white shadow-2xl relative transition-transform duration-200 origin-center" 
            style={{ width: project.width, height: project.height, transform: `scale(${project.zoom})` }}
          >
            {project.panels.map(p => (
              <PanelItem 
                key={p.id} 
                panel={p} 
                isSelected={selectedPanelId === p.id} 
                selectedLayerId={selectedLayerId}
                onPointerDown={(e: any) => { 
                  e.stopPropagation(); 
                  setSelectedPanelId(p.id);
                  setSelectedLayerId(null); 
                }}
              />
            ))}
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/5 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl z-50">
            <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="p-1 hover:text-indigo-400"><ZoomOut size={16}/></button>
            <span className="text-[10px] font-black w-10 text-center">{Math.round(project.zoom * 100)}%</span>
            <button onClick={() => setProject(p => ({...p, zoom: Math.min(2, p.zoom + 0.1)}))} className="p-1 hover:text-indigo-400"><ZoomIn size={16}/></button>
          </div>
        </div>

        {/* Layer Panel & Properties (Synchronized Hierarchy) */}
        <div className="w-80 bg-[#161616] border-l border-white/5 flex flex-col z-[100] shadow-2xl">
          {/* Page Hierarchy Section */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-white/5">
            <div className="p-4 bg-[#1a1a1a] border-b border-white/5">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Layers size={14}/> Layer System</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
              <div 
                className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all border border-transparent ${!selectedPanelId ? 'bg-indigo-600/20 border-indigo-500/50' : 'hover:bg-white/5'}`} 
                onClick={() => { setSelectedPanelId(null); setSelectedLayerId(null); }}
              >
                <File size={16} className="text-indigo-400" />
                <span className="text-[11px] font-black uppercase text-white truncate">{project.title}</span>
              </div>
              
              <div className="pl-5 space-y-3 border-l border-white/5 ml-2">
                {project.panels.map(panel => (
                  <div key={panel.id} className="space-y-1">
                    <div 
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border border-transparent group ${selectedPanelId === panel.id && !selectedLayerId ? 'bg-indigo-600/30 border-indigo-500/50 shadow-lg' : 'hover:bg-white/5'}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(null); }}
                    >
                      <Box size={14} className="text-gray-400 shrink-0" />
                      <span className="flex-1 text-[10px] font-black text-white truncate">{panel.title}</span>
                      <button onClick={(e) => { e.stopPropagation(); setProject(p => ({...p, panels: p.panels.filter(pan => pan.id !== panel.id)})); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"><Trash2 size={12}/></button>
                    </div>

                    <div className="pl-6 space-y-1">
                      {[...panel.layers].sort((a,b) => b.zIndex - a.zIndex).map(layer => (
                        <div 
                          key={layer.id} 
                          className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all border border-transparent group ${selectedLayerId === layer.id ? 'bg-indigo-500 border-indigo-400 shadow-md text-white' : 'hover:bg-white/5 text-gray-400'}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(layer.id); }}
                        >
                          <img src={layer.content} className="w-5 h-5 rounded-sm object-contain bg-black/40" />
                          <span className="flex-1 text-[9px] font-bold truncate">{layer.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); updatePanel(panel.id, { layers: panel.layers.filter(l => l.id !== layer.id) }); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contextual Properties Panel */}
          <div className="h-1/2 flex flex-col min-h-0 bg-[#141414]">
            <div className="p-4 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Settings size={14}/> Properties</h2>
              <span className="text-[8px] font-mono text-gray-500">{selectedLayer ? "LAYER" : selectedPanel ? "PANEL" : "PAGE"}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              {!selectedPanelId ? (
                <div className="space-y-4 animate-in fade-in">
                  <PropertyField label="Width" value={project.width} onChange={v => setProject({...project, width: +v})} />
                  <PropertyField label="Height" value={project.height} onChange={v => setProject({...project, height: +v})} />
                  <div className="pt-4 border-t border-white/5">
                    <label className="text-[8px] font-black text-gray-600 uppercase">Page Title</label>
                    <input className="w-full bg-black/40 p-2.5 rounded-xl border border-white/5 text-[10px] font-mono text-indigo-400 outline-none mt-2" value={project.title} onChange={e => setProject({...project, title: e.target.value})} />
                  </div>
                </div>
              ) : selectedLayerId && selectedLayer ? (
                <div className="space-y-6 animate-in slide-in-from-right-2">
                  <div className="grid grid-cols-2 gap-4">
                    <PropertyField label="X Pos (%)" value={Math.round(selectedLayer.x)} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { x: +v })} />
                    <PropertyField label="Y Pos (%)" value={Math.round(selectedLayer.y)} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { y: +v })} />
                    <PropertyField label="Scale" value={selectedLayer.scale} step={0.05} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { scale: +v })} />
                    <PropertyField label="Opacity" value={selectedLayer.opacity} step={0.1} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { opacity: +v })} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><label className="text-[8px] font-black text-gray-500 uppercase">Rotation</label><span className="text-[10px] font-mono text-indigo-400">{selectedLayer.rotation}°</span></div>
                    <input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { rotation: +e.target.value })} className="w-full h-1 bg-black accent-indigo-500 rounded appearance-none cursor-pointer" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-gray-500 uppercase">Skew X</label>
                      <input type="range" min="-45" max="45" value={selectedLayer.skewX || 0} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { skewX: +e.target.value })} className="w-full h-1 bg-black accent-indigo-500 rounded appearance-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-gray-500 uppercase">Skew Y</label>
                      <input type="range" min="-45" max="45" value={selectedLayer.skewY || 0} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { skewY: +e.target.value })} className="w-full h-1 bg-black accent-indigo-500 rounded appearance-none" />
                    </div>
                  </div>
                  <button onClick={() => updateLayer(selectedPanelId, selectedLayerId, { flipX: !selectedLayer.flipX })} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedLayer.flipX ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}>Flip Horizontal</button>
                </div>
              ) : selectedPanel ? (
                <div className="space-y-5 animate-in slide-in-from-right-2">
                   <div className="grid grid-cols-2 gap-4">
                    <PropertyField label="X" value={Math.round(selectedPanel.x)} onChange={v => updatePanel(selectedPanelId, { x: +v })} />
                    <PropertyField label="Y" value={Math.round(selectedPanel.y)} onChange={v => updatePanel(selectedPanelId, { y: +v })} />
                    <PropertyField label="Width" value={selectedPanel.width} onChange={v => updatePanel(selectedPanelId, { width: +v })} />
                    <PropertyField label="Height" value={selectedPanel.height} onChange={v => updatePanel(selectedPanelId, { height: +v })} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><label className="text-[8px] font-black text-gray-500 uppercase">Rotation</label><span className="text-[10px] font-mono text-indigo-400">{selectedPanel.rotation}°</span></div>
                    <input type="range" min="-180" max="180" value={selectedPanel.rotation} onChange={e => updatePanel(selectedPanelId, { rotation: +e.target.value })} className="w-full h-1 bg-black accent-indigo-500 rounded appearance-none cursor-pointer" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-500 uppercase">Fill Color</label>
                    <div className="flex gap-2">
                      <input type="color" value={selectedPanel.backgroundColor} onChange={e => updatePanel(selectedPanelId, { backgroundColor: e.target.value })} className="w-10 h-10 bg-black rounded-lg border border-white/10 cursor-pointer overflow-hidden p-0" />
                      <input type="text" value={selectedPanel.backgroundColor} onChange={e => updatePanel(selectedPanelId, { backgroundColor: e.target.value })} className="flex-1 bg-black border border-white/10 rounded-lg px-3 text-xs font-mono text-indigo-400 outline-none" />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Auxiliary Windows */}
      {showCanvasWindow && (
        <FloatingWindow title="PAGE DIMENSIONS" onClose={() => setShowCanvasWindow(false)} width="w-[440px]">
           <div className="grid grid-cols-2 gap-3">
              {Object.entries(CANVAS_PRESETS).map(([key, val]) => (
                <button key={key} onClick={() => { setProject(p => ({...p, width: val.width, height: val.height })); setShowCanvasWindow(false); }} className="bg-black/40 p-4 rounded-xl border border-white/5 hover:border-indigo-500 hover:bg-indigo-600/5 transition-all text-left">
                   <div className="text-[10px] font-black uppercase text-white">{val.name}</div>
                   <div className="text-[9px] text-gray-500 font-mono mt-1">{val.width}x{val.height} PX</div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {showLayoutWindow && (
        <FloatingWindow title="PANEL TEMPLATES" onClose={() => setShowLayoutWindow(false)} width="w-[440px]">
           <div className="space-y-3">
              {Object.entries(PANEL_LAYOUTS).map(([key, val]) => (
                <button key={key} onClick={() => applyLayout(key as keyof typeof PANEL_LAYOUTS)} className="w-full bg-black/40 p-5 rounded-xl border border-white/5 hover:border-indigo-500 flex items-center justify-between group">
                   <div className="text-[11px] font-black uppercase text-white">{val.name}</div>
                   <div className="text-[9px] text-indigo-400 font-bold">{val.panels.length} PANELS</div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {showAIWindow && (
        <FloatingWindow title="AI CREATIVE STUDIO" onClose={() => setShowAIWindow(false)} width="w-[560px]">
           <div className="space-y-5">
              <textarea className="w-full bg-black border border-white/10 p-5 rounded-2xl h-28 focus:border-indigo-500 outline-none text-sm font-bold shadow-inner" placeholder="Describe character or scene..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <button onClick={handleAIProduction} disabled={isGenerating} className="w-full bg-indigo-600 py-4 rounded-xl text-xs font-black uppercase tracking-widest">{isGenerating ? 'PROCESSING...' : 'GENERATE ASSET'}</button>
              {aiPreview && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="dark-transparency-grid aspect-square rounded-2xl flex items-center justify-center p-3 bg-black">
                     <img src={aiPreview} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-500 uppercase">Target Panel</label>
                    <select className="w-full bg-black border border-white/10 p-3 rounded-lg text-xs" value={targetPanelId || ''} onChange={e => setTargetPanelId(e.target.value)}>
                       <option value="">Select Panel...</option>
                       {project.panels.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <button onClick={() => {
                       if (!aiPreview || !targetPanelId) return;
                       const p = project.panels.find(p => p.id === targetPanelId);
                       if (!p) return;
                       const layer: Layer = {
                         id: `l${Date.now()}`, type: LayerType.CHARACTER,
                         name: `Asset_${Date.now().toString().slice(-4)}`, content: aiPreview, x: 50, y: 50, scale: 0.8, rotation: 0, opacity: 1, zIndex: p.layers.length + 1
                       };
                       updatePanel(targetPanelId, { layers: [...p.layers, layer] });
                       setAiPreview(null); setShowAIWindow(false);
                  }} className="w-full bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase text-white shadow-xl">Inject Into Panel</button>
                </div>
              )}
           </div>
        </FloatingWindow>
      )}

      {/* Status Bar */}
      <div className="h-9 bg-[#111] border-t border-white/5 px-4 flex items-center justify-between text-[10px] z-[200]">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-red-500'}`} />
             <span className="font-black uppercase text-gray-400">{aiSettings.backend.toUpperCase()}</span>
           </div>
           <div className="flex items-center gap-2 text-indigo-400 font-black italic">
             <Smile size={14}/> <span>{statusMessage}</span>
           </div>
        </div>
        <div className="text-gray-500 font-black uppercase tracking-widest">{tooltip}</div>
      </div>
    </div>
  );
};

const PanelItem = memo(({ panel, isSelected, selectedLayerId, onPointerDown }: any) => {
  return (
    <div 
      onPointerDown={onPointerDown}
      className={`absolute cursor-move transition-all duration-300
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 z-[50] shadow-2xl scale-[1.005]' : 'z-[10]'}`}
      style={{ 
        left: panel.x, top: panel.y, width: panel.width, height: panel.height, 
        transform: `rotate(${panel.rotation}deg)`, border: `${panel.borderThickness}px solid ${panel.borderColor}`, 
        backgroundColor: panel.backgroundColor,
        boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 2}px rgba(0,0,0,0.3)` : 'none'
      }}
    >
      {[...panel.layers].sort((a,b) => a.zIndex - b.zIndex).map(layer => {
        const isLayerSelected = isSelected && selectedLayerId === layer.id;
        return (
          <div key={layer.id} className={`absolute pointer-events-none transition-shadow ${isLayerSelected ? 'outline outline-2 outline-indigo-400 outline-offset-4 z-[100]' : ''}`} style={{ 
            left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.scale * 100}%`, 
            transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) skew(${layer.skewX || 0}deg, ${layer.skewY || 0}deg) scaleX(${layer.flipX ? -1 : 1})`, 
            opacity: layer.opacity, zIndex: layer.zIndex
          }}>
            <img src={layer.content} alt={layer.name} className="w-full h-auto" />
          </div>
        );
      })}
    </div>
  );
});

const ToolbarBtn = ({ icon, label, onClick, active, onMouseEnter }: any) => (
  <button onClick={onClick} onMouseEnter={onMouseEnter} className={`p-3.5 rounded-xl relative group transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'hover:bg-white/5 text-gray-500 hover:text-white'}`}>
    {icon}
    <div className="absolute left-full ml-4 bg-[#1a1a1a] p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hidden group-hover:block z-[500] border border-white/10 shadow-2xl whitespace-nowrap pointer-events-none">{label}</div>
  </button>
);

const PropertyField = ({ label, value, onChange, step = 1 }: { label: string, value: any, onChange: (v: string) => void, step?: number }) => (
  <div className="space-y-2">
    <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
    <input 
      type={typeof value === 'number' ? 'number' : 'text'} 
      step={step}
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-black/60 p-2.5 rounded-xl border border-white/5 text-[10px] font-mono text-indigo-400 outline-none focus:border-indigo-500/50 transition-all shadow-inner" 
    />
  </div>
);

export default App;
