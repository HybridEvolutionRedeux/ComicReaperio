
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Type, Square, Layout, ZoomIn, ZoomOut, Grid3X3,
  Mountain, User as UserIcon, Sparkles, 
  XCircle, FileImage, Cpu, Globe, Zap, RefreshCw, 
  CheckCircle2, AlertCircle, FolderOpen, HardDrive, Trash2,
  FileJson, FileText, Upload, ChevronUp, ChevronDown, Move, Eye, EyeOff,
  MessageSquare, MousePointer2, Box, File, Edit3, Smile, Info, Maximize, RotateCw,
  FlipHorizontal, FlipVertical, MoveDiagonal
} from 'lucide-react';
import { ComicProject, Panel, Layer, LayerType, AISettings, AIBackend } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import { FONT_PRESETS, COLORS, SpeechBubble } from './constants';
import * as aiService from './services/aiService';
import html2canvas from 'html2canvas';

const CANVAS_PRESETS = {
  GOLDEN_AGE: { width: 1200, height: 1800, name: 'Golden Age Comic', category: 'Print' },
  MANGA: { width: 1000, height: 1500, name: 'Tankobon (Manga)', category: 'Print' },
  WIDESCREEN: { width: 1920, height: 1080, name: 'HD Cinematic', category: 'Digital' },
  SQUARE: { width: 1080, height: 1080, name: 'Social Square', category: 'Digital' },
  POSTER: { width: 2480, height: 3508, name: 'A3 Poster', category: 'Print' },
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
  VERTICAL_MANGA: {
    name: 'Vertical Manga Flow',
    panels: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.2 },
      { x: 0.05, y: 0.28, w: 0.43, h: 0.67 },
      { x: 0.52, y: 0.28, w: 0.43, h: 0.32 },
      { x: 0.52, y: 0.63, w: 0.43, h: 0.32 }
    ]
  }
};

const STORAGE_KEY = 'comiccraft_studio_v18_final';

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
  const [statusMessage, setStatusMessage] = useState("Studio Initialized.");
  const [tooltip, setTooltip] = useState('Select an element from the Layer Panel or click a frame.');

  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setProject(prev => ({ ...prev, panels: prev.panels.map(p => p.id === id ? { ...p, ...updates } : p) }));
  }, []);

  const updateLayer = useCallback((pId: string, lId: string, updates: Partial<Layer>) => {
    setProject(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === pId ? { ...p, layers: p.layers.map(l => l.id === lId ? { ...l, ...updates } : l) } : p)
    }));
  }, []);

  const addSpeechBubble = useCallback(() => {
    if (!selectedPanelId) {
      setStatusMessage("Select a panel first!");
      return;
    }
    const panel = project.panels.find(p => p.id === selectedPanelId);
    if (!panel) return;

    const id = `l_bubble_${Date.now()}`;
    const newBubble: Layer = {
      id,
      type: LayerType.TEXT_BUBBLE,
      name: 'Speech Bubble',
      content: 'Write something...',
      x: 50,
      y: 50,
      scale: 0.3,
      rotation: 0,
      opacity: 1,
      zIndex: panel.layers.length + 1,
      bubbleType: 'speech',
      bubbleColor: '#ffffff',
      bubbleBorderColor: '#000000',
      font: 'Bangers',
      fontSize: 24,
      color: '#000000',
      tailX: 20,
      tailY: 85,
      flipX: false,
      flipY: false
    };

    updatePanel(selectedPanelId, { layers: [...panel.layers, newBubble] });
    setSelectedLayerId(id);
    setStatusMessage("Added speech bubble.");
  }, [selectedPanelId, project.panels, updatePanel]);

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
    setSelectedPanelId(null);
    setSelectedLayerId(null);
    setStatusMessage(`Constructed ${layout.name}.`);
  };

  const exportPNG = async () => {
    if (!workspaceRef.current) return;
    setIsExporting(true);
    const originalZoom = project.zoom;
    setProject(prev => ({ ...prev, zoom: 1 }));
    await new Promise(r => setTimeout(r, 800));
    try {
      const canvas = await html2canvas(workspaceRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${project.title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatusMessage("Comic Rendered!");
    } catch { setStatusMessage("Render Failed."); }
    setProject(prev => ({ ...prev, zoom: originalZoom }));
    setIsExporting(false);
  };

  const handleAIProduction = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const finalPrompt = await aiService.enhancePrompt(prompt);
      let img = await aiService.generateImage(finalPrompt, aiSettings);
      if (aiSettings.removeBackground) {
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
        {/* Main Sidebar */}
        <div className="w-16 bg-[#161616] border-r border-white/5 flex flex-col items-center py-6 gap-6 z-[100] shadow-2xl">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-black comic-font text-2xl shadow-lg cursor-pointer">C</div>
          
          <ToolbarBtn icon={<Plus size={20}/>} label="New Panel" onClick={() => {
            const id = `p${Date.now()}`;
            setProject(p => ({...p, panels: [...p.panels, {
              id, title: `Panel ${p.panels.length+1}`, x: 100, y: 100, width: 400, height: 300, rotation: 0, zIndex: p.panels.length+1,
              borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4, backgroundColor: '#ffffff', layers: []
            }]}));
            setSelectedPanelId(id);
          }} />
          <ToolbarBtn icon={<MessageSquare size={20}/>} label="Add Bubble" onClick={addSpeechBubble} onMouseEnter={() => setTooltip("Inject a dialogue bubble into active panel")} />
          <ToolbarBtn icon={<Layout size={20}/>} label="Canvas Size" onClick={() => setShowCanvasWindow(true)} active={showCanvasWindow} />
          <ToolbarBtn icon={<Grid3X3 size={20}/>} label="Templates" onClick={() => setShowLayoutWindow(true)} active={showLayoutWindow} />
          <ToolbarBtn icon={<Wand2 size={20}/>} label="AI Forge" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
          
          <div className="h-px w-8 bg-white/10" />
          
          <ToolbarBtn icon={<FileJson size={20}/>} label="Project JSON" onClick={() => {
             const data = JSON.stringify(project, null, 2);
             const blob = new Blob([data], { type: 'application/json' });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url; a.download = `${project.title}.json`; a.click();
          }} />
          
          <div className="mt-auto flex flex-col gap-4 mb-4">
             <ToolbarBtn icon={<FileImage size={20}/>} label="Export PNG" onClick={exportPNG} />
             <ToolbarBtn icon={<Settings size={20}/>} label="Settings" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
          </div>
        </div>

        {/* Studio Workspace */}
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
                onUpdateLayer={updateLayer}
                onPointerDown={(e: any) => { 
                  e.stopPropagation(); 
                  setSelectedPanelId(p.id);
                  setSelectedLayerId(null); 
                }}
              />
            ))}
          </div>

          {/* Zoom Control */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/5 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl z-50">
            <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="p-1 hover:text-indigo-400"><ZoomOut size={16}/></button>
            <span className="text-[10px] font-black w-10 text-center">{Math.round(project.zoom * 100)}%</span>
            <button onClick={() => setProject(p => ({...p, zoom: Math.min(2, p.zoom + 0.1)}))} className="p-1 hover:text-indigo-400"><ZoomIn size={16}/></button>
          </div>
        </div>

        {/* Professional Inspector Sidebar */}
        <div className="w-80 bg-[#161616] border-l border-white/5 flex flex-col z-[100] shadow-2xl overflow-hidden">
          {/* Layer Hierarchy */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-white/5">
            <div className="p-4 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Layers size={14}/> Layer Manager</h2>
              <span className="text-[8px] font-mono text-gray-600">STABLE</span>
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
                          {layer.type === LayerType.TEXT_BUBBLE ? <MessageSquare size={12} /> : <img src={layer.content} className="w-5 h-5 rounded-sm object-contain bg-black/40" />}
                          <span className="flex-1 text-[9px] font-bold truncate">{layer.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Properties Inspector */}
          <div className="h-1/2 flex flex-col min-h-0 bg-[#141414]">
            <div className="p-4 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Settings size={14}/> Properties</h2>
              <span className="text-[8px] font-mono text-gray-500">{selectedLayer?.type?.toUpperCase() || (selectedPanel ? "PANEL" : "PAGE")}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              {!selectedPanelId ? (
                <div className="space-y-4 animate-in fade-in">
                  <PropertyField label="Width" value={project.width} onChange={v => setProject({...project, width: +v})} />
                  <PropertyField label="Height" value={project.height} onChange={v => setProject({...project, height: +v})} />
                </div>
              ) : selectedLayerId && selectedLayer ? (
                <div className="space-y-6 animate-in slide-in-from-right-2">
                  {/* Generic Global Transformation */}
                  <div className="grid grid-cols-2 gap-4">
                    <PropertyField label="X Pos (%)" value={Math.round(selectedLayer.x)} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { x: +v })} />
                    <PropertyField label="Y Pos (%)" value={Math.round(selectedLayer.y)} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { y: +v })} />
                    <PropertyField label="Scale" value={selectedLayer.scale} step={0.05} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { scale: +v })} />
                    <PropertyField label="Rotation" value={selectedLayer.rotation} onChange={v => updateLayer(selectedPanelId, selectedLayerId, { rotation: +v })} />
                  </div>

                  {/* Universal Flip System */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => updateLayer(selectedPanelId, selectedLayerId, { flipX: !selectedLayer.flipX })}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase border transition-all ${selectedLayer.flipX ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}
                    >
                      <FlipHorizontal size={12}/> Flip H
                    </button>
                    <button 
                      onClick={() => updateLayer(selectedPanelId, selectedLayerId, { flipY: !selectedLayer.flipY })}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase border transition-all ${selectedLayer.flipY ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}
                    >
                      <FlipVertical size={12}/> Flip V
                    </button>
                  </div>

                  {/* Specialized Speech Bubble Logic */}
                  {selectedLayer.type === LayerType.TEXT_BUBBLE && (
                    <div className="space-y-5 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-gray-500 uppercase">Bubble Content</label>
                        <textarea className="w-full bg-black border border-white/10 p-2.5 rounded-lg text-xs font-bold text-white h-24 outline-none focus:border-indigo-500" value={selectedLayer.content} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { content: e.target.value })} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[8px] font-black text-gray-500 uppercase">Style</label>
                           <select className="w-full bg-black border border-white/10 p-2 rounded text-[10px] font-black" value={selectedLayer.bubbleType} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { bubbleType: e.target.value as any })}>
                              <option value="speech">Normal Speech</option>
                              <option value="thought">Cloud Thought</option>
                              <option value="shout">Action Shout</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[8px] font-black text-gray-500 uppercase">Font</label>
                           <select className="w-full bg-black border border-white/10 p-2 rounded text-[10px] font-black" value={selectedLayer.font} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { font: e.target.value })}>
                              {FONT_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
                           </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                         <div className="space-y-2">
                            <label className="text-[8px] font-black text-gray-500 uppercase">Bubble Fill</label>
                            <input type="color" value={selectedLayer.bubbleColor || '#ffffff'} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { bubbleColor: e.target.value })} className="w-full h-8 bg-black border border-white/10 rounded cursor-pointer" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[8px] font-black text-gray-500 uppercase">Bubble Border</label>
                            <input type="color" value={selectedLayer.bubbleBorderColor || '#000000'} onChange={e => updateLayer(selectedPanelId, selectedLayerId, { bubbleBorderColor: e.target.value })} className="w-full h-8 bg-black border border-white/10 rounded cursor-pointer" />
                         </div>
                      </div>

                      <div className="space-y-2">
                         <label className="text-[8px] font-black text-gray-500 uppercase">Text Color</label>
                         <div className="flex flex-wrap gap-2">
                            {COLORS.map(c => (
                              <button key={c} onClick={() => updateLayer(selectedPanelId, selectedLayerId, { color: c })} className={`w-6 h-6 rounded-md border border-white/10 ${selectedLayer.color === c ? 'ring-2 ring-indigo-500 scale-110' : ''}`} style={{ backgroundColor: c }} />
                            ))}
                         </div>
                      </div>
                      
                      <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                         <p className="text-[9px] font-black text-indigo-400 uppercase flex items-center gap-2"><MoveDiagonal size={12}/> Drag Tail Handle on Canvas</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedPanel ? (
                <div className="space-y-6 animate-in slide-in-from-right-2">
                  <div className="grid grid-cols-2 gap-4">
                    <PropertyField label="X Pos (px)" value={Math.round(selectedPanel.x)} onChange={v => updatePanel(selectedPanelId, { x: +v })} />
                    <PropertyField label="Y Pos (px)" value={Math.round(selectedPanel.y)} onChange={v => updatePanel(selectedPanelId, { y: +v })} />
                    <PropertyField label="Width" value={selectedPanel.width} onChange={v => updatePanel(selectedPanelId, { width: +v })} />
                    <PropertyField label="Height" value={selectedPanel.height} onChange={v => updatePanel(selectedPanelId, { height: +v })} />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[8px] font-black text-gray-500 uppercase">Panel Background</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['transparent', '#ffffff', '#fdf6e3', '#f0f0f0', '#000000', ...COLORS].filter((c, i, a) => a.indexOf(c) === i).map(c => (
                        <button 
                          key={c} 
                          onClick={() => updatePanel(selectedPanelId, { backgroundColor: c })} 
                          className={`w-6 h-6 rounded-md border border-white/10 relative overflow-hidden transition-all ${selectedPanel.backgroundColor === c ? 'ring-2 ring-indigo-500 scale-110 shadow-lg' : 'hover:border-white/30'}`} 
                          style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }} 
                        >
                          {c === 'transparent' && (
                            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '4px 4px' }} />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={selectedPanel.backgroundColor === 'transparent' ? '#ffffff' : selectedPanel.backgroundColor} 
                        onChange={e => updatePanel(selectedPanelId, { backgroundColor: e.target.value })} 
                        className="w-10 h-10 bg-black rounded-lg border border-white/10 cursor-pointer p-1 shrink-0" 
                      />
                      <div className="flex-1 text-[10px] font-mono text-gray-400 bg-black/40 p-2 rounded-lg border border-white/5 uppercase tracking-wider flex items-center justify-between">
                        <span>{selectedPanel.backgroundColor}</span>
                        {selectedPanel.backgroundColor === 'transparent' && <span className="text-[8px] font-black text-indigo-400">ALPHA</span>}
                      </div>
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

      {showAIWindow && (
        <FloatingWindow title="AI PRODUCTION STUDIO" onClose={() => setShowAIWindow(false)} width="w-[560px]">
           <div className="space-y-5">
              <textarea className="w-full bg-black border border-white/10 p-5 rounded-2xl h-28 focus:border-indigo-500 outline-none text-sm font-bold shadow-inner" placeholder="Detailed character or scene prompt..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <button onClick={handleAIProduction} disabled={isGenerating} className="w-full bg-indigo-600 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">{isGenerating ? 'GENERATING...' : 'PRODUCE ASSET'}</button>
              {aiPreview && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="dark-transparency-grid aspect-square rounded-2xl flex items-center justify-center p-3 bg-black">
                     <img src={aiPreview} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Target Selection</label>
                    <select className="w-full bg-black border border-white/10 p-3 rounded-lg text-xs font-bold text-indigo-400" value={targetPanelId || ''} onChange={e => setTargetPanelId(e.target.value)}>
                       <option value="">Choose a panel...</option>
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
                  }} className="w-full bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase text-white shadow-xl">Commit to Canvas</button>
                </div>
              )}
           </div>
        </FloatingWindow>
      )}

      {/* Footer Bar */}
      <div className="h-9 bg-[#111] border-t border-white/5 px-4 flex items-center justify-between text-[10px] z-[200]">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_green]" />
             <span className="font-black uppercase text-gray-400 tracking-widest">Gemini Engine Online</span>
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
        const transform = `translate(-50%, -50%) rotate(${layer.rotation}deg) skew(${layer.skewX || 0}deg, ${layer.skewY || 0}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`;

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
            className={`absolute pointer-events-auto transition-shadow ${isLayerSelected ? 'outline outline-2 outline-indigo-400 outline-offset-4 z-[100]' : ''} ${draggingLayerId === layer.id ? 'cursor-grabbing' : 'cursor-pointer'}`} 
            style={{ 
              left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.scale * 100}%`, 
              transform, 
              opacity: layer.opacity, zIndex: layer.zIndex
            }}
          >
            {layer.type === LayerType.TEXT_BUBBLE ? (
              <div className="relative w-full h-full flex items-center justify-center p-4 min-w-[50px] min-h-[50px]">
                 <SpeechBubble 
                   type={layer.bubbleType || 'speech'} 
                   tailX={layer.tailX} 
                   tailY={layer.tailY} 
                   color={layer.bubbleColor || 'white'} 
                   border={layer.bubbleBorderColor || 'black'} 
                 />
                 
                 {/* Interactive Tail Handle */}
                 {isLayerSelected && (
                    <div 
                      onPointerDown={(e) => { e.stopPropagation(); setDraggingTailId(layer.id); }}
                      className="absolute w-4 h-4 bg-yellow-400 border-2 border-black rounded-full cursor-crosshair z-[200] shadow-lg hover:scale-125 transition-transform"
                      style={{ 
                        left: `${layer.tailX}%`, 
                        top: `${layer.tailY}%`, 
                        transform: 'translate(-50%, -50%)' 
                      }}
                    />
                 )}

                 <div 
                    className="absolute inset-0 flex items-center justify-center p-[15%] text-center break-words leading-tight select-none pointer-events-none"
                    style={{ 
                      fontFamily: layer.font, 
                      fontSize: `${layer.fontSize}px`, 
                      color: layer.color 
                    }}
                 >
                   {layer.content}
                 </div>
              </div>
            ) : (
              <img src={layer.content} alt={layer.name} className="w-full h-auto pointer-events-none" />
            )}
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
