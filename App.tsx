
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Type, Square, Layout, ZoomIn, ZoomOut, Grid3X3,
  Mountain, User as UserIcon, Sparkles, 
  XCircle, FileImage, Cpu, Globe, Zap, RefreshCw, 
  CheckCircle2, AlertCircle, FolderOpen, HardDrive, Trash2,
  FileJson, FileText, Upload, ChevronUp, ChevronDown, Move, Eye, EyeOff,
  MessageSquare, MousePointer2, Box, File, Edit3, Smile, Info, Maximize, RotateCw,
  FlipHorizontal, FlipVertical, MoveDiagonal, Folder, ChevronRight, FileType, 
  MoreVertical, Share, Printer, DownloadCloud, Image as ImageIcon, Save, ShieldCheck,
  Package, LayoutDashboard, Database, Wifi, WifiOff, HardDriveDownload
} from 'lucide-react';
import { ComicProject, Panel, Layer, LayerType, AISettings, AIBackend } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import { FONT_PRESETS, COLORS, SpeechBubble } from './constants';
import * as aiService from './services/aiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CANVAS_PRESETS = {
  GOLDEN_AGE: { width: 1200, height: 1800, name: 'Golden Age Comic', category: 'Print' },
  MANGA: { width: 1000, height: 1500, name: 'Tankobon (Manga)', category: 'Print' },
  WIDESCREEN: { width: 1920, height: 1080, name: 'HD Cinematic', category: 'Digital' },
  INSTA_POST: { width: 1080, height: 1080, name: 'Square Panel', category: 'Digital' },
};

const PANEL_LAYOUTS = {
  GRID_6: {
    name: 'Standard 6-Panel Grid',
    panels: [
      { x: 0.05, y: 0.05, w: 0.43, h: 0.28 }, { x: 0.52, y: 0.05, w: 0.43, h: 0.28 },
      { x: 0.05, y: 0.36, w: 0.43, h: 0.28 }, { x: 0.52, y: 0.36, w: 0.43, h: 0.28 },
      { x: 0.05, y: 0.67, w: 0.43, h: 0.28 }, { x: 0.52, y: 0.67, w: 0.43, h: 0.28 }
    ]
  },
  SPLASH_TOP: {
    name: 'Top Splash Layout',
    panels: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.48 },
      { x: 0.05, y: 0.56, w: 0.28, h: 0.38 }, { x: 0.36, y: 0.56, w: 0.28, h: 0.38 }, { x: 0.67, y: 0.56, w: 0.28, h: 0.38 }
    ]
  },
  DYNAMIC_Z: {
    name: 'Dynamic Z-Flow',
    panels: [
      { x: 0.05, y: 0.05, w: 0.6, h: 0.3 },
      { x: 0.68, y: 0.05, w: 0.27, h: 0.3 },
      { x: 0.05, y: 0.38, w: 0.9, h: 0.25 },
      { x: 0.05, y: 0.66, w: 0.43, h: 0.29 }, { x: 0.52, y: 0.66, w: 0.43, h: 0.29 }
    ]
  }
};

const STORAGE_KEY = 'comiccraft_studio_v21';

const App: React.FC = () => {
  const [project, setProject] = useState<ComicProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { id: '1', title: 'New Comic', author: 'Artist', panels: [], width: 1200, height: 1800, zoom: 0.4, lastModified: Date.now() };
    } catch {
      return { id: '1', title: 'New Comic', author: 'Artist', panels: [], width: 1200, height: 1800, zoom: 0.4, lastModified: Date.now() };
    }
  });

  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_settings`);
    return saved ? JSON.parse(saved) : {
      backend: 'gemini', endpoint: 'http://127.0.0.1:7860', apiKey: '', model: '', negativePrompt: '', stylePreset: 'None', steps: 25, cfgScale: 7, sampler: 'Euler a', removeBackground: true, bgRemovalEngine: 'gemini', loras: [], checkpointFolderPath: '', loraFolderPath: ''
    };
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackendAlive, setIsBackendAlive] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);
  const [showCanvasWindow, setShowCanvasWindow] = useState(false);
  const [showLayoutWindow, setShowLayoutWindow] = useState(false);
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showProjectWindow, setShowProjectWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Studio Ready.");
  const [tooltip, setTooltip] = useState('Workspace active.');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [layerContextMenu, setLayerContextMenu] = useState<{ x: number, y: number, pId: string, lId: string } | null>(null);

  const workspaceRef = useRef<HTMLDivElement>(null);

  // Network & Heartbeat Effects
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      const alive = await aiService.checkBackendStatus(aiSettings.backend, aiSettings.endpoint);
      setIsBackendAlive(alive);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Heartbeat every 30s
    return () => clearInterval(interval);
  }, [aiSettings.backend, aiSettings.endpoint]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(aiSettings)); }, [aiSettings]);

  const loadLocalResources = useCallback(async () => {
    if (aiSettings.backend !== 'gemini') {
      const models = await aiService.fetchLocalModels(aiSettings.backend, aiSettings.endpoint);
      const loras = await aiService.fetchLocalLoras(aiSettings.backend, aiSettings.endpoint);
      setAvailableModels(models);
      setAvailableLoras(loras);
      setStatusMessage(`${models.length} Local Models Loaded.`);
    }
  }, [aiSettings.backend, aiSettings.endpoint]);

  useEffect(() => { loadLocalResources(); }, [loadLocalResources]);

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...updates } : p) }));
  }, []);

  const updateLayer = useCallback((pId: string, lId: string, updates: Partial<Layer>) => {
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === pId ? { ...p, layers: p.layers.map(l => l.id === lId ? { ...l, ...updates } : l) } : p)
    }));
  }, []);

  const changeLayerZ = useCallback((pId: string, lId: string, direction: 'up' | 'down') => {
    setProject(prev => {
      const panel = prev.panels.find(p => p.id === pId);
      if (!panel) return prev;
      
      const layers = [...panel.layers].sort((a, b) => a.zIndex - b.zIndex);
      const idx = layers.findIndex(l => l.id === lId);
      
      if (direction === 'up' && idx < layers.length - 1) {
        // Swap with the one above
        const currentLayer = layers[idx];
        const aboveLayer = layers[idx + 1];
        const tempZ = currentLayer.zIndex;
        currentLayer.zIndex = aboveLayer.zIndex;
        aboveLayer.zIndex = tempZ;
      } else if (direction === 'down' && idx > 0) {
        // Swap with the one below
        const currentLayer = layers[idx];
        const belowLayer = layers[idx - 1];
        const tempZ = currentLayer.zIndex;
        currentLayer.zIndex = belowLayer.zIndex;
        belowLayer.zIndex = tempZ;
      } else {
        return prev;
      }
      
      return {
        ...prev,
        panels: prev.panels.map(p => p.id === pId ? { ...p, layers: [...layers] } : p)
      };
    });
  }, []);

  const applyLayout = (layoutKey: keyof typeof PANEL_LAYOUTS) => {
    const layout = PANEL_LAYOUTS[layoutKey];
    const newPanels: Panel[] = layout.panels.map((p, i) => ({
      id: `p_layout_${Date.now()}_${i}`,
      title: `Panel ${i + 1}`,
      x: p.x * project.width,
      y: p.y * project.height,
      width: p.w * project.width,
      height: p.h * project.height,
      rotation: 0,
      zIndex: i + 1,
      borderThickness: 4,
      borderColor: '#000000',
      borderOpacity: 1,
      shadowIntensity: 4,
      backgroundColor: '#ffffff',
      layers: []
    }));
    setProject(prev => ({ ...prev, panels: newPanels }));
    setShowLayoutWindow(false);
    setStatusMessage("Template Applied.");
  };

  const syncToPyCharm = () => {
    const data = JSON.stringify({
      ...project,
      metadata: {
        backend: aiSettings.backend,
        endpoint: aiSettings.endpoint,
        exportedAt: new Date().toISOString()
      }
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/\s+/g, '_')}.comic.json`;
    a.click();
    setStatusMessage("Project synchronized to workspace.");
  };

  /**
   * Orchestrates the AI image production pipeline.
   * Fix: Explicitly typed 'img' as string to match state and function signatures.
   */
  const handleAIProduction = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const enhanced = await aiService.enhancePrompt(prompt);
      let img: string = await aiService.generateImage(enhanced, aiSettings);
      if (aiSettings.removeBackground && isOnline) {
        img = await aiService.removeBackground(img, aiSettings);
      }
      setAiPreview(img);
    } catch (e: any) { setStatusMessage(`Production Error: ${e.message}`); }
    finally { setIsGenerating(false); }
  };

  const selectedPanel = project.panels.find(p => p.id === selectedPanelId);
  const selectedLayer = selectedPanel?.layers.find(l => l.id === selectedLayerId);

  return (
    <div className="flex h-screen w-screen bg-[#050505] select-none overflow-hidden text-gray-400 font-sans flex-col" onPointerDown={() => setLayerContextMenu(null)}>
      <div className="flex flex-1 overflow-hidden">
        {/* Workspace Sidebar */}
        <div className="w-14 bg-[#111111] border-r border-white/5 flex flex-col items-center py-5 gap-6 z-[100] shadow-2xl">
          <div 
            onClick={() => setShowProjectWindow(true)}
            className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 group relative"
          >
            <Folder size={20} className="text-white" />
            <div className="absolute left-full ml-4 bg-black px-2 py-1.5 rounded text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">PyCharm Workspace</div>
          </div>
          
          <div className="h-px w-6 bg-white/10" />

          <ToolbarBtn icon={<Plus size={18}/>} label="New Panel" onClick={() => {
            const id = `p${Date.now()}`;
            setProject(p => ({...p, panels: [...p.panels, {
              id, title: `Panel ${p.panels.length+1}`, x: 100, y: 100, width: 400, height: 300, rotation: 0, zIndex: p.panels.length+1,
              borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4, backgroundColor: '#ffffff', layers: []
            }]}));
            setSelectedPanelId(id);
          }} />
          <ToolbarBtn icon={<MessageSquare size={18}/>} label="Add Bubble" onClick={() => {
            if (!selectedPanelId) return setStatusMessage("Select panel first.");
            const p = project.panels.find(pan => pan.id === selectedPanelId);
            if (!p) return;
            const lid = `l_bub_${Date.now()}`;
            const b: Layer = { id: lid, type: LayerType.TEXT_BUBBLE, name: 'Dialogue', content: 'WRITE...', x: 50, y: 50, scale: 0.3, rotation: 0, opacity: 1, zIndex: p.layers.length + 1, bubbleType: 'speech', bubbleColor: '#ffffff', bubbleBorderColor: '#000000', font: 'Bangers', fontSize: 24, color: '#000000', tailX: 20, tailY: 85 };
            updatePanel(selectedPanelId, { layers: [...p.layers, b] });
            setSelectedLayerId(lid);
          }} />
          <ToolbarBtn icon={<Wand2 size={18}/>} label="AI Generator" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
          <ToolbarBtn icon={<Layout size={18}/>} label="Page Presets" onClick={() => setShowCanvasWindow(true)} active={showCanvasWindow} />
          <ToolbarBtn icon={<Grid3X3 size={18}/>} label="Panel Layouts" onClick={() => setShowLayoutWindow(true)} active={showLayoutWindow} />
          
          <div className="mt-auto flex flex-col gap-4 mb-4">
             <div className="relative">
               <ToolbarBtn icon={<Download size={18}/>} label="Export Menu" onClick={() => setShowExportMenu(!showExportMenu)} />
               {showExportMenu && (
                 <div className="absolute left-full bottom-0 ml-4 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-2 z-[500] w-36 flex flex-col gap-1">
                    {['png', 'jpg', 'webp', 'pdf'].map(fmt => (
                       <button key={fmt} onClick={async () => {
                          if (!workspaceRef.current) return;
                          setShowExportMenu(false);
                          setIsExporting(true);
                          const canvas = await html2canvas(workspaceRef.current, { scale: 2 });
                          const link = document.createElement('a');
                          link.download = `export.${fmt}`;
                          link.href = canvas.toDataURL(`image/${fmt === 'pdf' ? 'jpeg' : fmt}`);
                          link.click();
                          setIsExporting(false);
                       }} className="w-full text-left px-3 py-2 rounded hover:bg-indigo-600 text-[9px] font-black uppercase text-white">Save {fmt}</button>
                    ))}
                 </div>
               )}
             </div>
             <ToolbarBtn icon={<Settings size={18}/>} label="Engine Settings" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
          </div>
        </div>

        {/* Studio Stage */}
        <div className="flex-1 relative bg-[#0a0a0a] flex items-center justify-center overflow-auto custom-scrollbar" onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); }}>
          <div 
            ref={workspaceRef} 
            className="bg-white shadow-2xl relative transition-transform duration-200" 
            style={{ width: project.width, height: project.height, transform: `scale(${project.zoom})` }}
          >
            {project.panels.map(p => (
              <PanelItem 
                key={p.id} panel={p} isSelected={selectedPanelId === p.id} 
                selectedLayerId={selectedLayerId} onUpdateLayer={updateLayer}
                onPointerDown={(e: any) => { e.stopPropagation(); setSelectedPanelId(p.id); setSelectedLayerId(null); }}
              />
            ))}
          </div>

          {/* Network Status HUD */}
          <div className="absolute top-6 left-6 flex items-center gap-5 bg-black/80 backdrop-blur-xl border border-white/5 rounded-2xl px-5 py-2.5 pointer-events-none shadow-2xl">
             <div className="flex items-center gap-2">
                {isOnline ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-red-500" />}
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{isOnline ? 'CLOUD ENABLED' : 'OFFLINE MODE'}</span>
             </div>
             <div className="w-px h-4 bg-white/10" />
             <div className="flex items-center gap-2">
                <Cpu size={14} className={isBackendAlive ? 'text-indigo-400' : 'text-gray-700'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                   {aiSettings.backend.toUpperCase()}: {isBackendAlive ? 'ONLINE' : 'UNREACHABLE'}
                </span>
             </div>
          </div>

          <div className="absolute bottom-8 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl z-50">
            <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="hover:text-indigo-400"><ZoomOut size={18}/></button>
            <span className="text-[10px] font-black w-12 text-center text-white">{Math.round(project.zoom * 100)}%</span>
            <button onClick={() => setProject(p => ({...p, zoom: Math.min(3, p.zoom + 0.1)}))} className="hover:text-indigo-400"><ZoomIn size={18}/></button>
          </div>
        </div>

        {/* Hierarchy Sidebar */}
        <div className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col z-[100] shadow-2xl">
           <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 bg-[#141414] border-b border-white/5 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Layers size={14}/> Node Tree</h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                 {project.panels.map(panel => (
                    <div key={panel.id} className="space-y-1">
                       <div 
                         className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all border border-transparent ${selectedPanelId === panel.id && !selectedLayerId ? 'bg-indigo-600/20 border-indigo-500/30 text-white' : 'hover:bg-white/5 text-gray-500'}`}
                         onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(null); }}
                       >
                         <Box size={14} className="text-gray-600" />
                         <span className="text-[10px] font-black uppercase tracking-wide truncate flex-1">{panel.title}</span>
                       </div>
                       <div className="pl-6 space-y-1 border-l border-white/5 ml-2.5">
                          {panel.layers.map(layer => (
                            <div 
                              key={layer.id}
                              onContextMenu={(e) => { e.preventDefault(); setLayerContextMenu({ x: e.clientX, y: e.clientY, pId: panel.id, lId: layer.id }); }}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedLayerId === layer.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/5 text-gray-600'}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(layer.id); }}
                            >
                               {layer.type === LayerType.TEXT_BUBBLE ? <MessageSquare size={12} /> : <ImageIcon size={12} />}
                               <span className="text-[9px] font-bold truncate flex-1 uppercase tracking-tighter">{layer.name}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="h-1/3 bg-[#0d0d0d] border-t border-white/5 p-5 space-y-5 overflow-y-auto custom-scrollbar">
              {selectedLayer && selectedPanelId ? (
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => changeLayerZ(selectedPanelId, selectedLayer.id, 'up')} className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all"><ChevronUp size={14}/> Bring Forward</button>
                       <button onClick={() => changeLayerZ(selectedPanelId, selectedLayer.id, 'down')} className="bg-white/5 hover:bg-white/10 text-gray-400 p-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border border-white/5 transition-all"><ChevronDown size={14}/> Send Backward</button>
                    </div>
                    <PropertyField label="Scale" value={selectedLayer.scale} step={0.05} onChange={v => updateLayer(selectedPanelId, selectedLayer.id, { scale: +v })} />
                    <PropertyField label="Rotation" value={selectedLayer.rotation} onChange={v => updateLayer(selectedPanelId, selectedLayer.id, { rotation: +v })} />
                 </div>
              ) : selectedPanel ? (
                 <div className="space-y-4">
                    <PropertyField label="Pos X" value={Math.round(selectedPanel.x)} onChange={v => updatePanel(selectedPanelId, { x: +v })} />
                    <PropertyField label="Pos Y" value={Math.round(selectedPanel.y)} onChange={v => updatePanel(selectedPanelId, { y: +v })} />
                 </div>
              ) : <div className="text-[10px] font-black uppercase text-gray-700 text-center py-10 tracking-[0.2em]">Idle</div>}
           </div>
        </div>
      </div>

      {/* Page Presets Window */}
      {showCanvasWindow && (
        <FloatingWindow title="PAGE PRESETS" onClose={() => setShowCanvasWindow(false)} width="w-[450px]">
           <div className="grid grid-cols-1 gap-2">
              {Object.entries(CANVAS_PRESETS).map(([key, val]) => (
                <button key={key} onClick={() => { setProject(p => ({...p, width: val.width, height: val.height })); setShowCanvasWindow(false); }} className="bg-black/60 p-4 rounded-xl border border-white/5 hover:border-indigo-600 transition-all flex items-center justify-between text-left group">
                   <div>
                      <div className="text-[11px] font-black uppercase text-white group-hover:text-indigo-400">{val.name}</div>
                      <div className="text-[10px] text-gray-600 font-mono mt-1">{val.width} x {val.height} PX</div>
                   </div>
                   <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-2 py-1 bg-indigo-500/10 rounded">{val.category}</div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {/* Panel Layouts Window */}
      {showLayoutWindow && (
        <FloatingWindow title="PANEL TEMPLATES" onClose={() => setShowLayoutWindow(false)} width="w-[450px]">
           <div className="grid grid-cols-1 gap-2">
              {Object.entries(PANEL_LAYOUTS).map(([key, val]) => (
                <button key={key} onClick={() => applyLayout(key as keyof typeof PANEL_LAYOUTS)} className="w-full bg-black/60 p-5 rounded-xl border border-white/5 hover:border-indigo-500 flex items-center justify-between group transition-all">
                   <div className="text-left font-black uppercase text-white text-[11px] group-hover:text-indigo-400">{val.name}</div>
                   <Grid3X3 size={18} className="text-gray-700 group-hover:text-indigo-500" />
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {/* Project Hub (PyCharm Sync) */}
      {showProjectWindow && (
        <FloatingWindow title="PYCHARM WORKSPACE SYNC" onClose={() => setShowProjectWindow(false)} width="w-[580px]">
           <div className="flex gap-6 h-[400px]">
              <div className="w-48 bg-black/40 rounded-3xl p-4 flex flex-col gap-3 border border-white/5">
                 <ExplorerFolder label="Active Story" active />
                 <ExplorerFolder label="Assets Root" />
                 <div className="mt-auto pt-5 border-t border-white/5 flex flex-col gap-3">
                    <button onClick={() => { setProject({ id: Date.now().toString(), title: 'New Comic', author: 'Artist', panels: [], width: 1200, height: 1800, zoom: 0.4, lastModified: Date.now() }); setShowProjectWindow(false); }} className="w-full bg-indigo-600 py-3 rounded-2xl text-[10px] font-black uppercase text-white shadow-xl hover:bg-indigo-500 transition-all">New Project</button>
                    <button onClick={syncToPyCharm} className="w-full bg-white/5 text-gray-500 p-3 rounded-2xl text-[9px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"><HardDriveDownload size={14}/> Sync to Disk</button>
                 </div>
              </div>
              <div className="flex-1 bg-black/60 rounded-3xl p-6 border border-white/5">
                 <div className="text-[11px] font-black uppercase text-indigo-400 tracking-widest border-b border-white/10 pb-4 mb-4">Project File Explorer</div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-[2/3] bg-white rounded-2xl flex items-center justify-center shadow-2xl scale-95 border-4 border-indigo-600 group cursor-pointer overflow-hidden">
                       <span className="text-black font-black text-2xl comic-font uppercase">PAGE 01</span>
                       <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="aspect-[2/3] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center hover:bg-white/5 cursor-pointer group transition-all">
                       <Plus size={32} className="text-gray-800 group-hover:text-indigo-400" />
                       <span className="text-[9px] font-black uppercase text-gray-800 mt-2 tracking-widest">Append Frame</span>
                    </div>
                 </div>
              </div>
           </div>
        </FloatingWindow>
      )}

      {/* Production Forge */}
      {showAIWindow && (
        <FloatingWindow title="PRODUCTION FORGE" onClose={() => setShowAIWindow(false)} width="w-[700px]">
           <div className="grid grid-cols-12 gap-8 h-[520px] p-2">
              <div className="col-span-5 space-y-6 overflow-y-auto pr-3 custom-scrollbar">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Production Engine</label>
                    <select className="w-full bg-black border border-white/10 p-3 rounded-2xl text-[10px] font-black uppercase text-white outline-none" value={aiSettings.backend} onChange={e => setAiSettings({...aiSettings, backend: e.target.value as any})}>
                       <option value="gemini">Gemini Cloud (Internet Req)</option>
                       <option value="automatic1111">Local SD (A1111 API)</option>
                       <option value="comfyui">ComfyUI (Workflow API)</option>
                    </select>
                 </div>

                 {aiSettings.backend !== 'gemini' && (
                    <div className="space-y-4 p-4 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl">
                       <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Checkpoint</label>
                          <select className="w-full bg-black border border-white/10 p-2.5 rounded-xl text-[10px] font-bold text-white" value={aiSettings.model} onChange={e => setAiSettings({...aiSettings, model: e.target.value})}>
                             {availableModels.length > 0 ? availableModels.map(m => <option key={m} value={m}>{m}</option>) : <option value="">Auto-Detecting Models...</option>}
                          </select>
                       </div>
                    </div>
                 )}

                 <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Negative Prompting</label>
                    <textarea className="w-full bg-black border border-white/10 p-3 rounded-2xl h-24 text-[10px] font-bold text-gray-300 outline-none" placeholder="Elements to exclude..." value={aiSettings.negativePrompt} onChange={e => setAiSettings({...aiSettings, negativePrompt: e.target.value})} />
                 </div>

                 <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <input type="checkbox" disabled={!isOnline} checked={aiSettings.removeBackground && isOnline} onChange={e => setAiSettings({...aiSettings, removeBackground: e.target.checked})} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-gray-300' : 'text-gray-600'} cursor-pointer`}>Auto-Transparency (Cloud)</label>
                 </div>
              </div>

              <div className="col-span-7 flex flex-col gap-5">
                 <textarea className="flex-1 w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-bold" placeholder="Scene Description..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                 <button onClick={handleAIProduction} disabled={isGenerating} className="w-full bg-indigo-600 py-4.5 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl hover:bg-indigo-500 transition-all text-white flex items-center justify-center gap-3">
                    {isGenerating ? <><RefreshCw size={18} className="animate-spin"/> Crafting Asset...</> : <><Zap size={18} fill="currentColor"/> Generate Production Asset</>}
                 </button>

                 <div className="h-60 bg-black rounded-3xl border border-white/10 relative overflow-hidden flex items-center justify-center">
                    {aiPreview ? (
                      <div className="w-full h-full p-5 flex flex-col gap-4">
                         <div className="flex-1 flex items-center justify-center min-h-0">
                            <img src={aiPreview} className="max-w-full max-h-full object-contain" />
                         </div>
                         <button onClick={() => {
                            if (!targetPanelId) return setStatusMessage("Select target frame.");
                            const p = project.panels.find(pan => pan.id === targetPanelId);
                            if (!p) return;
                            const l: Layer = { id: `l_ast_${Date.now()}`, type: LayerType.CHARACTER, name: 'Asset', content: aiPreview!, x: 50, y: 50, scale: 0.8, rotation: 0, opacity: 1, zIndex: p.layers.length + 1 };
                            updatePanel(targetPanelId, { layers: [...p.layers, l] });
                            setAiPreview(null);
                         }} className="bg-white text-black p-3 rounded-2xl font-black uppercase text-[10px]">Commit to Workspace</button>
                      </div>
                    ) : <Database size={40} className="text-gray-800" />}
                 </div>
                 <select className="w-full bg-indigo-600/10 border border-indigo-500/30 p-3 rounded-2xl text-[10px] font-black uppercase text-indigo-400" value={targetPanelId || ''} onChange={e => setTargetPanelId(e.target.value)}>
                    <option value="">Select Target Frame...</option>
                    {project.panels.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                 </select>
              </div>
           </div>
        </FloatingWindow>
      )}

      {/* Settings Window */}
      {showSettingsWindow && (
        <FloatingWindow title="ENGINE CONFIGURATION" onClose={() => setShowSettingsWindow(false)} width="w-[480px]">
           <div className="space-y-6">
              <PropertyField label="Local API Endpoint" value={aiSettings.endpoint} onChange={v => setAiSettings({...aiSettings, endpoint: v})} />
              <div className="p-5 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 flex items-center gap-4">
                 <ShieldCheck size={20} className="text-indigo-400" />
                 <div className="text-[10px] font-black uppercase tracking-tighter text-gray-400">Environment bridge active. Status: {isBackendAlive ? 'ONLINE' : 'OFFLINE'}</div>
              </div>
              <button onClick={() => { setShowSettingsWindow(false); loadLocalResources(); }} className="w-full bg-indigo-600 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest">Update Settings</button>
           </div>
        </FloatingWindow>
      )}

      {/* Footer Bar */}
      <div className="h-9 bg-[#080808] border-t border-white/5 px-5 flex items-center justify-between text-[11px] z-[200]">
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-3">
             <div className={`w-2.5 h-2.5 rounded-full ${isBackendAlive ? 'bg-green-500' : 'bg-red-500'} animate-pulse shadow-xl`} />
             <span className="font-black uppercase text-gray-500 tracking-tighter">Engine: {aiSettings.backend.toUpperCase()}</span>
           </div>
           <div className="flex items-center gap-3 text-indigo-400 font-black italic">
             <Info size={16}/> <span>{statusMessage}</span>
           </div>
        </div>
        <div className="text-gray-600 font-black uppercase tracking-[0.2em] flex items-center gap-2">
           <LayoutDashboard size={14}/> {project.panels.length} PANELS | {isOnline ? 'CLOUD ACTIVE' : 'LOCAL MODE'}
        </div>
      </div>
    </div>
  );
};

const ExplorerFolder = ({ label, active }: { label: string, active?: boolean }) => (
  <div className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${active ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-inner' : 'hover:bg-white/5 text-gray-700'}`}>
     <ChevronRight size={16} className={active ? 'rotate-90' : ''} />
     <Folder size={18} className={active ? 'text-indigo-400' : 'text-gray-800'} />
     <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

const ToolbarBtn = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3.5 rounded-xl relative group transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'hover:bg-white/5 text-gray-600 hover:text-white'}`}>
    {icon}
    <div className="absolute left-full ml-4 bg-black/90 backdrop-blur-md px-3 py-2 rounded-xl text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity z-[500] pointer-events-none tracking-[0.2em] whitespace-nowrap border border-white/10 shadow-2xl">{label}</div>
  </button>
);

const PropertyField = ({ label, value, onChange, step = 1 }: { label: string, value: any, onChange: (v: string) => void, step?: number }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
    <input 
      type={typeof value === 'number' ? 'number' : 'text'} 
      step={step}
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-black border border-white/5 p-3 rounded-2xl text-[11px] font-mono text-indigo-400 outline-none" 
    />
  </div>
);

const PanelItem = memo(({ panel, isSelected, selectedLayerId, onUpdateLayer, onPointerDown }: any) => {
  const [draggingTailId, setDraggingTailId] = useState<string | null>(null);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0, layerX: 0, layerY: 0 });
  const bubbleRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (draggingTailId && bubbleRefs.current[draggingTailId]) {
      const rect = bubbleRefs.current[draggingTailId]!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onUpdateLayer(panel.id, draggingTailId, { tailX: x, tailY: y });
    } else if (draggingLayerId && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStartPos.x) / rect.width * 100;
      const dy = (e.clientY - dragStartPos.y) / rect.height * 100;
      onUpdateLayer(panel.id, draggingLayerId, { 
        x: dragStartPos.layerX + dx, 
        y: dragStartPos.layerY + dy 
      });
    }
  }, [draggingTailId, draggingLayerId, dragStartPos, panel.id, onUpdateLayer]);

  const handlePointerUp = useCallback(() => {
    setDraggingTailId(null);
    setDraggingLayerId(null);
  }, []);

  useEffect(() => {
    if (draggingTailId || draggingLayerId) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggingTailId, draggingLayerId, handlePointerMove, handlePointerUp]);

  return (
    <div 
      ref={panelRef}
      onPointerDown={onPointerDown}
      className={`absolute cursor-move transition-all duration-300
        ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-4 z-[50] shadow-2xl scale-[1.005]' : 'z-[10]'}`}
      style={{ 
        left: panel.x, top: panel.y, width: panel.width, height: panel.height, 
        transform: `rotate(${panel.rotation}deg)`, border: `${panel.borderThickness}px solid ${panel.borderColor}`, 
        backgroundColor: panel.backgroundColor,
        boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 3}px rgba(0,0,0,0.5)` : 'none'
      }}
    >
      {[...panel.layers].sort((a,b) => a.zIndex - b.zIndex).map(layer => {
        const isLayerSelected = isSelected && selectedLayerId === layer.id;
        const transform = `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`;

        return (
          <div 
            key={layer.id} 
            ref={el => { bubbleRefs.current[layer.id] = el; }}
            onPointerDown={(e) => {
               if (isLayerSelected) {
                  e.stopPropagation();
                  setDraggingLayerId(layer.id);
                  setDragStartPos({ x: e.clientX, y: e.clientY, layerX: layer.x, layerY: layer.y });
               }
            }}
            className={`absolute pointer-events-auto group ${isLayerSelected ? 'outline outline-4 outline-indigo-500 outline-offset-8 z-[100] scale-[1.02]' : ''} ${draggingLayerId === layer.id ? 'cursor-grabbing' : 'cursor-pointer'} transition-transform`} 
            style={{ 
              left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.scale * 100}%`, 
              transform, opacity: layer.opacity, zIndex: layer.zIndex
            }}
          >
            {layer.type === LayerType.TEXT_BUBBLE ? (
              <div className="relative w-full h-full flex items-center justify-center p-6 min-w-[80px] min-h-[80px]">
                 <SpeechBubble type={layer.bubbleType || 'speech'} tailX={layer.tailX} tailY={layer.tailY} color={layer.bubbleColor || 'white'} border={layer.bubbleBorderColor || 'black'} />
                 {isLayerSelected && (
                    <div onPointerDown={(e) => { e.stopPropagation(); setDraggingTailId(layer.id); }} className="absolute w-4 h-4 bg-yellow-400 border-2 border-black rounded-full cursor-crosshair z-[200] shadow-xl hover:scale-150 transition-transform" style={{ left: `${layer.tailX}%`, top: `${layer.tailY}%`, transform: 'translate(-50%, -50%)' }} />
                 )}
                 <div className="absolute inset-0 flex items-center justify-center p-[20%] text-center break-words leading-[1.1] select-none pointer-events-none comic-font" style={{ fontFamily: layer.font, fontSize: `${layer.fontSize}px`, color: layer.color }}>{layer.content}</div>
              </div>
            ) : <img src={layer.content} alt={layer.name} className="w-full h-auto pointer-events-none drop-shadow-2xl transition-transform" />}
          </div>
        );
      })}
    </div>
  );
});

export default App;
