
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
  MoreVertical, Share, Printer, DownloadCloud, Image as ImageIcon, Save, ShieldCheck
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
  SQUARE: { width: 1080, height: 1080, name: 'Social Post', category: 'Digital' },
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

const STORAGE_KEY = 'comiccraft_studio_v20';

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
  const [tooltip, setTooltip] = useState('Select a tool to begin.');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [layerContextMenu, setLayerContextMenu] = useState<{ x: number, y: number, pId: string, lId: string } | null>(null);

  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(aiSettings)); }, [aiSettings]);

  useEffect(() => {
    const loadModels = async () => {
      if (aiSettings.backend !== 'gemini') {
        const models = await aiService.fetchLocalModels(aiSettings.backend, aiSettings.endpoint);
        setAvailableModels(models);
      }
    };
    loadModels();
  }, [aiSettings.backend, aiSettings.endpoint]);

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...updates } : p) }));
  }, []);

  const updateLayer = useCallback((pId: string, lId: string, updates: Partial<Layer>) => {
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === pId ? { ...p, layers: p.layers.map(l => l.id === lId ? { ...l, ...updates } : l) } : p)
    }));
  }, []);

  const applyLayout = (layoutKey: keyof typeof PANEL_LAYOUTS) => {
    const layout = PANEL_LAYOUTS[layoutKey];
    const newPanels: Panel[] = layout.panels.map((p, i) => ({
      id: `p_lay_${Date.now()}_${i}`,
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
    setStatusMessage(`Constructed ${layout.name}.`);
  };

  const addSpeechBubble = useCallback(() => {
    if (!selectedPanelId) return setStatusMessage("Active Panel Required.");
    const panel = project.panels.find(p => p.id === selectedPanelId);
    if (!panel) return;

    const id = `l_bubble_${Date.now()}`;
    const newBubble: Layer = {
      id, type: LayerType.TEXT_BUBBLE, name: 'Speech Bubble', content: 'DIALOGUE', x: 50, y: 50, scale: 0.3, rotation: 0, opacity: 1, zIndex: panel.layers.length + 1, bubbleType: 'speech', bubbleColor: '#ffffff', bubbleBorderColor: '#000000', font: 'Bangers', fontSize: 24, color: '#000000', tailX: 20, tailY: 85
    };
    updatePanel(selectedPanelId, { layers: [...panel.layers, newBubble] });
    setSelectedLayerId(id);
  }, [selectedPanelId, project.panels, updatePanel]);

  const handleExport = async (format: 'png' | 'jpg' | 'webp' | 'pdf') => {
    if (!workspaceRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    const originalZoom = project.zoom;
    setProject(p => ({ ...p, zoom: 1 }));
    await new Promise(r => setTimeout(r, 1000));

    try {
      const canvas = await html2canvas(workspaceRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      
      if (format === 'pdf') {
        const pdf = new jsPDF({ orientation: project.width > project.height ? 'l' : 'p', unit: 'px', format: [project.width, project.height] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, project.width, project.height);
        pdf.save(`${project.title}.pdf`);
      } else {
        const link = document.createElement('a');
        link.download = `${project.title}.${format}`;
        link.href = canvas.toDataURL(`image/${format}`, 1.0);
        link.click();
      }
      setStatusMessage(`Exported as ${format.toUpperCase()}`);
    } catch {
      setStatusMessage("Export Failed.");
    }
    setProject(p => ({ ...p, zoom: originalZoom }));
    setIsExporting(false);
  };

  const handleAIProduction = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const enhanced = await aiService.enhancePrompt(prompt);
      let img = await aiService.generateImage(enhanced, aiSettings);
      if (aiSettings.removeBackground) {
        img = await aiService.removeBackground(img, aiSettings);
      }
      setAiPreview(img);
    } catch (e: any) { setStatusMessage(`AI Error: ${e.message}`); }
    finally { setIsGenerating(false); }
  };

  const selectedPanel = project.panels.find(p => p.id === selectedPanelId);
  const selectedLayer = selectedPanel?.layers.find(l => l.id === selectedLayerId);

  return (
    <div className="flex h-screen w-screen bg-[#0d0d0d] select-none overflow-hidden text-gray-300 font-sans flex-col" onPointerDown={() => setLayerContextMenu(null)}>
      <div className="flex flex-1 overflow-hidden">
        {/* IDE Side Toolbar */}
        <div className="w-14 bg-[#1a1a1a] border-r border-white/5 flex flex-col items-center py-4 gap-4 z-[100] shadow-2xl">
          <div 
            onClick={() => setShowProjectWindow(true)}
            className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg group relative"
          >
            <Folder size={20} className="text-white" />
            <div className="absolute left-full ml-3 bg-black px-2 py-1 rounded text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Explorer</div>
          </div>
          
          <div className="h-px w-6 bg-white/10 my-2" />

          <ToolbarBtn icon={<Plus size={18}/>} label="New Panel" onClick={() => {
            const id = `p${Date.now()}`;
            setProject(p => ({...p, panels: [...p.panels, {
              id, title: `Panel ${p.panels.length+1}`, x: 100, y: 100, width: 400, height: 300, rotation: 0, zIndex: p.panels.length+1,
              borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4, backgroundColor: '#ffffff', layers: []
            }]}));
            setSelectedPanelId(id);
          }} />
          <ToolbarBtn icon={<MessageSquare size={18}/>} label="Dialogue" onClick={addSpeechBubble} />
          <ToolbarBtn icon={<Wand2 size={18}/>} label="AI Generator" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
          <ToolbarBtn icon={<Layout size={18}/>} label="Page Setup" onClick={() => setShowCanvasWindow(true)} active={showCanvasWindow} />
          <ToolbarBtn icon={<Grid3X3 size={18}/>} label="Panel Layouts" onClick={() => setShowLayoutWindow(true)} active={showLayoutWindow} />
          
          <div className="mt-auto flex flex-col gap-4 mb-4">
             <div className="relative">
               <ToolbarBtn icon={<Download size={18}/>} label="Export" onClick={() => setShowExportMenu(!showExportMenu)} />
               {showExportMenu && (
                 <div className="absolute left-full bottom-0 ml-4 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-2 z-[500] w-32 flex flex-col gap-1">
                    {['png', 'jpg', 'webp', 'pdf'].map(fmt => (
                      <button key={fmt} onClick={() => handleExport(fmt as any)} className="w-full text-left px-3 py-1.5 rounded hover:bg-indigo-600 text-[9px] font-black uppercase tracking-widest">{fmt}</button>
                    ))}
                 </div>
               )}
             </div>
             <ToolbarBtn icon={<Settings size={18}/>} label="AI Settings" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
          </div>
        </div>

        {/* Central Stage */}
        <div className="flex-1 relative bg-[#090909] flex items-center justify-center overflow-auto custom-scrollbar" onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); }}>
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
          
          {/* Status Display Overlay */}
          <div className="absolute top-6 left-6 flex items-center gap-4 bg-black/40 backdrop-blur-md border border-white/5 rounded-full px-4 py-2 pointer-events-none">
             <div className="text-[10px] font-black uppercase text-gray-500 tracking-tighter">PROJECT: <span className="text-white">{project.title}</span></div>
             <div className="w-px h-3 bg-white/10" />
             <div className="text-[10px] font-black uppercase text-gray-500 tracking-tighter">ENGINE: <span className="text-indigo-400">{aiSettings.backend}</span></div>
          </div>

          {/* Scale Control */}
          <div className="absolute bottom-6 bg-[#1a1a1a] border border-white/10 rounded-full px-5 py-2.5 flex items-center gap-6 shadow-2xl z-50">
            <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="hover:text-indigo-400 transition-colors"><ZoomOut size={16}/></button>
            <span className="text-[9px] font-black w-10 text-center tracking-widest">{Math.round(project.zoom * 100)}%</span>
            <button onClick={() => setProject(p => ({...p, zoom: Math.min(2, p.zoom + 0.1)}))} className="hover:text-indigo-400 transition-colors"><ZoomIn size={16}/></button>
          </div>
        </div>

        {/* Hierarchy Sidebar */}
        <div className="w-72 bg-[#161616] border-l border-white/5 flex flex-col z-[100] shadow-2xl">
           <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between">
                <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Layer Stack</h2>
                <Layers size={14} className="opacity-40" />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                 {project.panels.map(panel => (
                    <div key={panel.id} className="space-y-1">
                       <div 
                         className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border border-transparent ${selectedPanelId === panel.id && !selectedLayerId ? 'bg-indigo-600/30 border-indigo-500/50' : 'hover:bg-white/5'}`}
                         onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(null); }}
                       >
                         <Box size={14} className="text-gray-500" />
                         <span className="text-[10px] font-black uppercase tracking-wide truncate">{panel.title}</span>
                       </div>
                       <div className="pl-6 space-y-0.5 border-l border-white/5 ml-1.5">
                          {panel.layers.map(layer => (
                            <div 
                              key={layer.id}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setLayerContextMenu({ x: e.clientX, y: e.clientY, pId: panel.id, lId: layer.id });
                              }}
                              className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all ${selectedLayerId === layer.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-white/5 text-gray-500'}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(layer.id); }}
                            >
                               {layer.type === LayerType.TEXT_BUBBLE ? <MessageSquare size={12} /> : <ImageIcon size={12} />}
                               <span className="text-[9px] font-bold truncate flex-1">{layer.name}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="h-2/5 bg-[#141414] border-t border-white/5 flex flex-col overflow-hidden">
              <div className="p-4 bg-[#1a1a1a] border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-indigo-400">Inspector</div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                 {selectedLayer && selectedPanelId ? (
                    <div className="space-y-4">
                       <PropertyField label="Scale" value={selectedLayer.scale} step={0.05} onChange={v => updateLayer(selectedPanelId, selectedLayer.id, { scale: +v })} />
                       <PropertyField label="Rotation" value={selectedLayer.rotation} onChange={v => updateLayer(selectedPanelId, selectedLayer.id, { rotation: +v })} />
                       <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => updateLayer(selectedPanelId, selectedLayer.id, { flipX: !selectedLayer.flipX })} className={`p-2 rounded text-[8px] font-black uppercase border transition-all ${selectedLayer.flipX ? 'bg-indigo-600 border-indigo-400' : 'bg-black border-white/5'}`}><FlipHorizontal size={14}/></button>
                         <button onClick={() => updateLayer(selectedPanelId, selectedLayer.id, { flipY: !selectedLayer.flipY })} className={`p-2 rounded text-[8px] font-black uppercase border transition-all ${selectedLayer.flipY ? 'bg-indigo-600 border-indigo-400' : 'bg-black border-white/5'}`}><FlipVertical size={14}/></button>
                       </div>
                    </div>
                 ) : selectedPanel ? (
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <PropertyField label="X Pos" value={selectedPanel.x} onChange={v => updatePanel(selectedPanelId, { x: +v })} />
                        <PropertyField label="Y Pos" value={selectedPanel.y} onChange={v => updatePanel(selectedPanelId, { y: +v })} />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-gray-500">Panel Background</label>
                         <input type="color" value={selectedPanel.backgroundColor} onChange={e => updatePanel(selectedPanelId, { backgroundColor: e.target.value })} className="w-full h-8 bg-black border border-white/5 rounded cursor-pointer" />
                      </div>
                   </div>
                 ) : <div className="text-[9px] font-black text-gray-600 italic text-center mt-4">NO SELECTION</div>}
              </div>
           </div>
        </div>
      </div>

      {/* Page Presets Window */}
      {showCanvasWindow && (
        <FloatingWindow title="PAGE PRESETS" onClose={() => setShowCanvasWindow(false)} width="w-[440px]">
           <div className="grid grid-cols-1 gap-2">
              {Object.entries(CANVAS_PRESETS).map(([key, val]) => (
                <button key={key} onClick={() => { setProject(p => ({...p, width: val.width, height: val.height })); setShowCanvasWindow(false); }} className="bg-black/40 p-4 rounded-xl border border-white/5 hover:border-indigo-500 hover:bg-indigo-600/5 transition-all flex items-center justify-between text-left">
                   <div>
                      <div className="text-[10px] font-black uppercase text-white">{val.name}</div>
                      <div className="text-[9px] text-gray-500 font-mono mt-1">{val.width} x {val.height} PX</div>
                   </div>
                   <div className="text-[8px] font-black text-indigo-500 uppercase tracking-widest px-2 py-1 bg-black rounded-md">{val.category}</div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {/* Structural Layouts Window */}
      {showLayoutWindow && (
        <FloatingWindow title="STRUCTURAL LAYOUTS" onClose={() => setShowLayoutWindow(false)} width="w-[440px]">
           <div className="space-y-2">
              {Object.entries(PANEL_LAYOUTS).map(([key, val]) => (
                <button key={key} onClick={() => applyLayout(key as keyof typeof PANEL_LAYOUTS)} className="w-full bg-black/40 p-5 rounded-xl border border-white/5 hover:border-indigo-500 flex items-center justify-between group">
                   <div className="text-left font-black uppercase text-white text-[11px]">{val.name}</div>
                   <div className="w-10 h-10 rounded bg-[#111] flex items-center justify-center group-hover:bg-indigo-600 transition-colors"><Grid3X3 size={16}/></div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {/* AI Settings Window */}
      {showSettingsWindow && (
        <FloatingWindow title="AI ENGINE CONFIGURATION" onClose={() => setShowSettingsWindow(false)} width="w-[480px]">
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Generation Backend</label>
                 <div className="grid grid-cols-3 gap-2">
                    {['gemini', 'automatic1111', 'comfyui'].map(b => (
                       <button 
                         key={b} 
                         onClick={() => setAiSettings({...aiSettings, backend: b as any})}
                         className={`p-2 rounded-lg text-[10px] font-black uppercase border transition-all ${aiSettings.backend === b ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black border-white/5 text-gray-500'}`}
                       >
                         {b}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                 <PropertyField label="API Endpoint (Local)" value={aiSettings.endpoint} onChange={v => setAiSettings({...aiSettings, endpoint: v})} />
                 <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                    <ShieldCheck size={16} className="text-green-500" />
                    <div className="flex-1">
                       <div className="text-[9px] font-black uppercase text-white">Advanced Safety Filters</div>
                       <div className="text-[8px] text-gray-500">Gemini content safety is active by default.</div>
                    </div>
                 </div>
              </div>

              <button 
                onClick={() => { setShowSettingsWindow(false); setStatusMessage("Config Saved."); }}
                className="w-full bg-indigo-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
              >
                <Save size={14} /> Commit Changes
              </button>
           </div>
        </FloatingWindow>
      )}

      {/* Project Explorer Window */}
      {showProjectWindow && (
        <FloatingWindow title="PROJECT EXPLORER" onClose={() => setShowProjectWindow(false)} width="w-[520px]">
           <div className="flex gap-4 h-[440px]">
              <div className="w-44 bg-black/40 rounded-xl p-3 flex flex-col gap-1 border border-white/5">
                 <ExplorerFolder label="Story Pages" active />
                 <ExplorerFolder label="Backgrounds" />
                 <ExplorerFolder label="Characters" />
                 <ExplorerFolder label="Script Assets" />
                 <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
                    <button onClick={() => { setProject({ id: Date.now().toString(), title: 'New Comic', author: 'Artist', panels: [], width: 1200, height: 1800, zoom: 0.4, lastModified: Date.now() }); setShowProjectWindow(false); }} className="w-full bg-indigo-600/20 text-indigo-400 p-2 rounded text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">New Story</button>
                    <button onClick={() => {
                        const data = JSON.stringify(project);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `${project.title}.json`; a.click();
                    }} className="w-full bg-white/5 text-gray-400 p-2 rounded text-[8px] font-black uppercase hover:bg-white/10 transition-all">Export JSON</button>
                 </div>
              </div>
              <div className="flex-1 bg-black/60 rounded-xl p-4 border border-white/5 overflow-y-auto">
                 <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><FileType size={14}/> Virtual Filesystem</div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="aspect-[2/3] bg-white p-1 rounded-lg shadow-xl relative group cursor-pointer border-2 border-indigo-600">
                       <div className="w-full h-full bg-gray-100 flex items-center justify-center text-black font-black text-[20px] comic-font">PAGE 1</div>
                       <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize size={24} className="text-white" />
                       </div>
                    </div>
                    <div className="aspect-[2/3] bg-black/20 rounded-lg flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-indigo-500/50 cursor-pointer transition-all">
                       <Plus size={32} className="text-gray-700" />
                       <span className="text-[8px] font-black uppercase text-gray-700 mt-2 tracking-widest">Add Page</span>
                    </div>
                 </div>
              </div>
           </div>
        </FloatingWindow>
      )}

      {/* Advanced AI Generator */}
      {showAIWindow && (
        <FloatingWindow title="AI PRODUCTION STUDIO" onClose={() => setShowAIWindow(false)} width="w-[640px]">
           <div className="grid grid-cols-12 gap-6 h-[500px]">
              <div className="col-span-5 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                 <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Art Engine</label>
                    <select className="w-full bg-black/60 border border-white/10 p-2 rounded text-[10px] font-black uppercase" value={aiSettings.backend} onChange={e => setAiSettings({...aiSettings, backend: e.target.value as any})}>
                       <option value="gemini">Google Gemini Cloud</option>
                       <option value="automatic1111">Stable Diffusion (Local)</option>
                       <option value="comfyui">ComfyUI (Local)</option>
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Style Preset</label>
                    <select className="w-full bg-black/60 border border-white/10 p-2 rounded text-[10px] font-black" value={aiSettings.stylePreset} onChange={e => setAiSettings({...aiSettings, stylePreset: e.target.value})}>
                       {Object.keys(aiService.STYLE_PRESETS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Negative Prompt</label>
                    <textarea className="w-full bg-black/60 border border-white/10 p-2 rounded h-20 text-[9px] font-bold outline-none focus:border-indigo-500" placeholder="Exclude things like: text, photo, blurry..." value={aiSettings.negativePrompt} onChange={e => setAiSettings({...aiSettings, negativePrompt: e.target.value})} />
                 </div>

                 <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <input type="checkbox" checked={aiSettings.removeBackground} onChange={e => setAiSettings({...aiSettings, removeBackground: e.target.checked})} className="w-4 h-4 accent-indigo-500" />
                    <label className="text-[9px] font-black uppercase tracking-widest cursor-pointer">Auto-Transparency</label>
                 </div>
              </div>

              <div className="col-span-7 flex flex-col gap-4">
                 <textarea className="flex-1 w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-indigo-500 text-sm font-bold shadow-inner" placeholder="Detailed character or scene description..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                 <button onClick={handleAIProduction} disabled={isGenerating} className="w-full bg-indigo-600 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-indigo-500 active:scale-95 transition-all">
                    {isGenerating ? <div className="flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin"/> Crafting Asset...</div> : 'GENERATE ASSET'}
                 </button>

                 <div className="flex-1 bg-black rounded-2xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute inset-0 dark-transparency-grid opacity-20 pointer-events-none" />
                    {aiPreview ? (
                      <div className="w-full h-full p-4 flex flex-col gap-3 relative">
                         <div className="flex-1 flex items-center justify-center min-h-0">
                            <img src={aiPreview} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                         </div>
                         <div className="flex gap-2">
                            <select className="flex-1 bg-indigo-600 text-white p-2 rounded-lg text-[10px] font-black uppercase outline-none" value={targetPanelId || ''} onChange={e => setTargetPanelId(e.target.value)}>
                               <option value="">Commit to Panel...</option>
                               {project.panels.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                            <button 
                              onClick={() => {
                                if (!aiPreview || !targetPanelId) return;
                                const p = project.panels.find(pan => pan.id === targetPanelId);
                                if (!p) return;
                                const layer: Layer = {
                                  id: `l${Date.now()}`, type: aiSettings.removeBackground ? LayerType.CHARACTER : LayerType.BACKGROUND,
                                  name: `Asset_${Date.now().toString().slice(-4)}`, content: aiPreview, x: 50, y: 50, scale: 0.8, rotation: 0, opacity: 1, zIndex: p.layers.length + 1
                                };
                                updatePanel(targetPanelId, { layers: [...p.layers, layer] });
                                setAiPreview(null);
                                setStatusMessage("Asset Materialized.");
                              }}
                              className="bg-white text-black px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:bg-indigo-400 hover:text-white transition-all shadow-xl"
                            >Confirm</button>
                         </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-700">
                         <Zap size={32} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Command</span>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </FloatingWindow>
      )}

      {/* Context Menu */}
      {layerContextMenu && (
        <div 
          className="fixed bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-2 z-[2000] w-48 flex flex-col gap-1"
          style={{ left: layerContextMenu.x, top: layerContextMenu.y }}
        >
           <button onClick={async () => {
              const layer = project.panels.find(p => p.id === layerContextMenu.pId)?.layers.find(l => l.id === layerContextMenu.lId);
              if (layer) {
                const link = document.createElement('a');
                link.download = `${layer.name}.png`;
                link.href = layer.content;
                link.click();
              }
              setLayerContextMenu(null);
           }} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded hover:bg-indigo-600 group transition-all">
              <DownloadCloud size={14} className="text-indigo-400 group-hover:text-white" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white">Save Object</span>
           </button>
           <button onClick={() => {
              const panel = project.panels.find(p => p.id === layerContextMenu.pId);
              if (panel) {
                updatePanel(panel.id, { layers: panel.layers.filter(l => l.id !== layerContextMenu.lId) });
              }
              setLayerContextMenu(null);
           }} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded hover:bg-red-600 group transition-all">
              <Trash2 size={14} className="text-red-500 group-hover:text-white" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white">Delete Layer</span>
           </button>
        </div>
      )}

      {/* Footer System Bar */}
      <div className="h-8 bg-[#111] border-t border-white/5 px-4 flex items-center justify-between text-[10px] z-[200]">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
             <span className="font-black uppercase text-gray-500 tracking-tighter">Gemini Pro v2 / Engine Online</span>
           </div>
           <div className="flex items-center gap-2 text-indigo-400 font-bold italic">
             <Info size={14}/> <span>{statusMessage}</span>
           </div>
        </div>
        <div className="text-gray-600 font-black uppercase tracking-[0.2em]">{tooltip}</div>
      </div>
    </div>
  );
};

const ExplorerFolder = ({ label, active }: { label: string, active?: boolean }) => (
  <div className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer group transition-all ${active ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-white/5 text-gray-600'}`}>
     <ChevronRight size={14} className={`${active ? 'rotate-90' : ''} transition-transform`} />
     <Folder size={14} className={active ? 'text-indigo-400' : 'text-gray-700'} />
     <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

const ToolbarBtn = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3 rounded-xl relative group transition-all ${active ? 'bg-indigo-600 text-white shadow-xl' : 'hover:bg-white/5 text-gray-600 hover:text-white'}`}>
    {icon}
    <div className="absolute left-full ml-3 bg-black px-2 py-1.5 rounded text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity z-[500] pointer-events-none tracking-widest whitespace-nowrap border border-white/10">{label}</div>
  </button>
);

const PropertyField = ({ label, value, onChange, step = 1 }: { label: string, value: any, onChange: (v: string) => void, step?: number }) => (
  <div className="space-y-1.5">
    <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{label}</label>
    <input 
      type={typeof value === 'number' ? 'number' : 'text'} 
      step={step}
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-black border border-white/5 p-2 rounded-lg text-[9px] font-mono text-indigo-400 outline-none focus:border-indigo-500/50 transition-all" 
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
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingTailId, draggingLayerId, handlePointerMove, handlePointerUp]);

  return (
    <div 
      ref={panelRef}
      onPointerDown={onPointerDown}
      className={`absolute cursor-move transition-all duration-300
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-4 z-[50] shadow-2xl' : 'z-[10]'}`}
      style={{ 
        left: panel.x, top: panel.y, width: panel.width, height: panel.height, 
        transform: `rotate(${panel.rotation}deg)`, border: `${panel.borderThickness}px solid ${panel.borderColor}`, 
        backgroundColor: panel.backgroundColor,
        boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 2}px rgba(0,0,0,0.4)` : 'none'
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
            className={`absolute pointer-events-auto ${isLayerSelected ? 'outline outline-2 outline-indigo-500 outline-offset-4 z-[100]' : ''} ${draggingLayerId === layer.id ? 'cursor-grabbing' : 'cursor-pointer'}`} 
            style={{ 
              left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.scale * 100}%`, 
              transform, opacity: layer.opacity, zIndex: layer.zIndex
            }}
          >
            {layer.type === LayerType.TEXT_BUBBLE ? (
              <div className="relative w-full h-full flex items-center justify-center p-4 min-w-[50px] min-h-[50px]">
                 <SpeechBubble type={layer.bubbleType || 'speech'} tailX={layer.tailX} tailY={layer.tailY} color={layer.bubbleColor || 'white'} border={layer.bubbleBorderColor || 'black'} />
                 {isLayerSelected && (
                    <div onPointerDown={(e) => { e.stopPropagation(); setDraggingTailId(layer.id); }} className="absolute w-3 h-3 bg-yellow-400 border border-black rounded-full cursor-crosshair z-[200]" style={{ left: `${layer.tailX}%`, top: `${layer.tailY}%`, transform: 'translate(-50%, -50%)' }} />
                 )}
                 <div className="absolute inset-0 flex items-center justify-center p-[15%] text-center break-words leading-tight select-none pointer-events-none" style={{ fontFamily: layer.font, fontSize: `${layer.fontSize}px`, color: layer.color }}>{layer.content}</div>
              </div>
            ) : <img src={layer.content} alt={layer.name} className="w-full h-auto pointer-events-none" />}
          </div>
        );
      })}
    </div>
  );
});

export default App;
