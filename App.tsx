
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Type, Square, Layout, ZoomIn, ZoomOut,
  ChevronUp, ChevronDown, ChevronFirst, ChevronLast,
  Mountain, User as UserIcon, Sparkles, 
  Menu as MenuIcon, Upload, XCircle, FileImage, Frame,
  Cpu, Globe, Zap, Trash2, Sliders, RefreshCw
} from 'lucide-react';
import { ComicProject, Panel, Layer, LayerType, AISettings, AIBackend, SelectedLora } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import { SpeechBubble } from './constants';
import * as aiService from './services/aiService';
import html2canvas from 'html2canvas';

const PAGE_PRESETS = {
  COMIC: { width: 1200, height: 1800, name: 'Standard Comic' },
  MANGA: { width: 1000, height: 1500, name: 'Manga Page' },
  COVER: { width: 1400, height: 2000, name: 'Book Cover' },
  SQUARE: { width: 1080, height: 1080, name: 'Social Post' }
};

const STORAGE_KEY = 'comiccraft_studio_session_v5';

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
    backend: 'gemini',
    endpoint: 'http://127.0.0.1:7860',
    apiKey: '',
    model: '',
    steps: 20,
    cfgScale: 7,
    sampler: 'Euler a',
    removeBackground: true,
    loras: []
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showTextWindow, setShowTextWindow] = useState(false);
  const [showPresetsWindow, setShowPresetsWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiActionLabel, setAiActionLabel] = useState('Thinking...');
  const [prompt, setPrompt] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiAssetType, setAiAssetType] = useState<'character' | 'background'>('character');

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'global' | 'panel', panelId?: string } | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragInfo, setDragInfo] = useState<any>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);

  const refreshLocalAssets = useCallback(async () => {
    if (aiSettings.backend === 'automatic1111') {
      const models = await aiService.fetchA1111Models(aiSettings.endpoint);
      const loras = await aiService.fetchA1111Loras(aiSettings.endpoint);
      setAvailableModels(models);
      setAvailableLoras(loras);
      if (models.length > 0 && !aiSettings.model) {
        setAiSettings(s => ({ ...s, model: models[0] }));
      }
    }
  }, [aiSettings.backend, aiSettings.endpoint, aiSettings.model]);

  useEffect(() => {
    if (showAIWindow) refreshLocalAssets();
  }, [showAIWindow, refreshLocalAssets]);

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
      id, x: 100, y: 100, width: 400, height: 300, rotation: 0, zIndex: project.panels.length + 1,
      borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4,
      backgroundColor: '#ffffff', layers: [], ...custom
    };
    setProject(prev => ({ ...prev, panels: [...prev.panels, newPanel] }));
    setSelectedPanelId(id);
  }, [project.panels.length]);

  const handleAIProduction = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setAiActionLabel(`Querying ${aiSettings.backend.toUpperCase()}...`);
    try {
      const finalPrompt = await aiService.enhancePrompt(prompt);
      let img = await aiService.generateImage(finalPrompt, aiSettings);
      if (aiAssetType === 'character' && aiSettings.removeBackground) {
        setAiActionLabel('Removing Background...');
        img = await aiService.removeBackground(img);
      }
      setAiPreview(img);
    } catch (e: any) { 
      alert(e.message || "Production failed."); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const addLora = (name: string) => {
    if (aiSettings.loras.find(l => l.name === name)) return;
    setAiSettings(s => ({ ...s, loras: [...s.loras, { name, weight: 1.0 }] }));
  };

  const updateLoraWeight = (name: string, weight: number) => {
    setAiSettings(s => ({
      ...s,
      loras: s.loras.map(l => l.name === name ? { ...l, weight } : l)
    }));
  };

  const removeLora = (name: string) => {
    setAiSettings(s => ({ ...s, loras: s.loras.filter(l => l.name !== name) }));
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] select-none overflow-hidden text-gray-200 font-sans">
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => { try { setProject(JSON.parse(ev.target?.result as string)); } catch { alert("Invalid Project JSON"); } };
        r.readAsText(f);
      }} />

      {/* Toolbar */}
      <div className="w-16 bg-[#161616] border-r border-white/5 flex flex-col items-center py-6 gap-6 z-[100] shadow-2xl">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-black comic-font text-2xl shadow-lg hover:scale-110 transition-transform">C</div>
        <ToolbarBtn icon={<Plus size={20}/>} label="New Panel" onClick={() => addPanel()} />
        <ToolbarBtn icon={<Layout size={20}/>} label="Templates" onClick={() => setShowPresetsWindow(true)} />
        <ToolbarBtn icon={<Type size={20}/>} label="Text" onClick={() => setShowTextWindow(true)} />
        <ToolbarBtn icon={<Wand2 size={20}/>} label="AI Studio" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
        <div className="mt-auto flex flex-col gap-4 mb-4">
           <ToolbarBtn icon={<FileImage size={20}/>} label="Export PNG" onClick={async () => {
              if (!workspaceRef.current) return;
              setIsExporting(true);
              const z = project.zoom; setProject(p => ({ ...p, zoom: 1 }));
              setTimeout(async () => {
                const canvas = await html2canvas(workspaceRef.current!, { useCORS: true, scale: 2 });
                const a = document.createElement('a'); a.download = 'comic_render.png'; a.href = canvas.toDataURL(); a.click();
                setIsExporting(false); setProject(p => ({ ...p, zoom: z }));
              }, 200);
           }} />
           <ToolbarBtn icon={<Settings size={20}/>} label="Studio Settings" onClick={() => setShowSettingsWindow(true)} />
        </div>
      </div>

      {/* Production Workspace */}
      <div className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-auto custom-scrollbar" onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); setContextMenu(null); }}>
        <div ref={workspaceRef} className="bg-white shadow-2xl relative transition-transform duration-200" style={{ width: project.width, height: project.height, transform: `scale(${project.zoom})`, transformOrigin: 'center center' }}>
          {project.panels.map(p => (
            <PanelItem 
              key={p.id} panel={p} isSelected={selectedPanelId === p.id} 
              isTarget={targetPanelId === p.id && showAIWindow}
              onPointerDown={(e:any, pId:any, lId:any) => {
                e.stopPropagation(); setSelectedPanelId(pId); if (lId) setSelectedLayerId(lId);
                setDragInfo({ id: pId, lId, startX: e.clientX, startY: e.clientY });
                (e.target as Element).setPointerCapture(e.pointerId);
              }}
              onContextMenu={(e:any, id:any) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'panel', panelId: id }); }}
            />
          ))}
        </div>

        {/* HUD Navigation */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/5 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl z-50">
          <button className="text-gray-500 hover:text-white" onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))}><ZoomOut size={16}/></button>
          <span className="text-[10px] font-black w-10 text-center tracking-tighter">{Math.round(project.zoom * 100)}%</span>
          <button className="text-gray-500 hover:text-white" onClick={() => setProject(p => ({...p, zoom: Math.min(2, p.zoom + 0.1)}))}><ZoomIn size={16}/></button>
        </div>

        {isGenerating && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center gap-6 animate-in fade-in">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <Zap className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={32}/>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-white text-xs font-black uppercase tracking-[0.4em] mb-1">{aiActionLabel}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase italic">Hardware: {aiSettings.backend.toUpperCase()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Inspector Sidebar */}
      <div className="w-80 bg-[#111111] border-l border-white/5 flex flex-col h-full z-50">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#161616]">
           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Inspector</span>
           <Layers size={14} className="text-gray-500"/>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
           {selectedPanelId ? (
             <div className="space-y-6">
                <PanelProps panel={project.panels.find(p => p.id === selectedPanelId)} onUpdate={(u:any) => updatePanel(selectedPanelId!, u)} />
                <div className="h-px bg-white/5"></div>
                {selectedLayerId && <LayerProps layer={project.panels.find(p => p.id === selectedPanelId)?.layers.find(l => l.id === selectedLayerId)} onUpdate={(u:any) => updateLayer(selectedPanelId!, selectedLayerId!, u)} />}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
               <div className="w-12 h-12 rounded-full border border-dashed border-gray-600 flex items-center justify-center"><MousePointer2 size={20} className="text-gray-600"/></div>
               <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Select an Asset</div>
             </div>
           )}
        </div>
      </div>

      {/* AI Production Studio */}
      {showAIWindow && (
        <FloatingWindow title="AI PRODUCTION STUDIO" onClose={() => setShowAIWindow(false)} width="w-[520px]">
           <div className="space-y-5">
              <div className="flex p-1 bg-black/40 rounded-xl gap-1">
                 <button onClick={() => setAiSettings(s => ({...s, backend: 'gemini'}))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiSettings.backend === 'gemini' ? 'bg-indigo-600 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Globe size={14}/> Gemini</button>
                 <button onClick={() => setAiSettings(s => ({...s, backend: 'automatic1111'}))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiSettings.backend === 'automatic1111' ? 'bg-indigo-600 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Cpu size={14}/> SD Local</button>
              </div>

              {aiSettings.backend === 'automatic1111' && (
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-4 animate-in slide-in-from-top-2">
                   <div className="flex items-center justify-between">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Settings size={12}/> Local SD Hardware</label>
                     <button onClick={refreshLocalAssets} className="text-indigo-400 hover:rotate-180 transition-all duration-500"><RefreshCw size={14}/></button>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[8px] font-bold text-gray-600 uppercase">Checkpoint (Model)</label>
                      <select 
                        className="w-full bg-black border border-white/10 p-2 rounded text-xs font-bold text-indigo-400 outline-none"
                        value={aiSettings.model}
                        onChange={(e) => setAiSettings(s => ({ ...s, model: e.target.value }))}
                      >
                        {availableModels.length > 0 ? (
                          availableModels.map(m => <option key={m} value={m}>{m.split('/').pop()}</option>)
                        ) : (
                          <option>No models found...</option>
                        )}
                      </select>
                   </div>
                   
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-bold text-gray-600 uppercase">Active LoRAs</label>
                        <select 
                          className="bg-indigo-600/20 text-indigo-400 border-none text-[10px] font-black uppercase px-2 py-1 rounded cursor-pointer"
                          onChange={(e) => {
                            if (e.target.value) addLora(e.target.value);
                            e.target.value = "";
                          }}
                        >
                          <option value="">+ Add LoRA</option>
                          {availableLoras.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                         {aiSettings.loras.map(lora => (
                           <div key={lora.name} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5 group">
                              <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black uppercase truncate text-gray-400">{lora.name}</div>
                                <input 
                                  type="range" min="0" max="2" step="0.1" 
                                  value={lora.weight} 
                                  onChange={(e) => updateLoraWeight(lora.name, +e.target.value)}
                                  className="w-full h-1 accent-indigo-500 appearance-none bg-black/40 rounded-full"
                                />
                              </div>
                              <div className="text-[10px] font-mono text-indigo-400 w-8">{lora.weight.toFixed(1)}</div>
                              <button onClick={() => removeLora(lora.name)} className="text-gray-600 hover:text-red-500"><XCircle size={14}/></button>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              )}

              <div className="flex gap-2">
                 <button onClick={() => setAiAssetType('character')} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase border transition-all ${aiAssetType === 'character' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-400' : 'bg-black/20 border-white/5 text-gray-500'}`}>Hero Character</button>
                 <button onClick={() => setAiAssetType('background')} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase border transition-all ${aiAssetType === 'background' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-400' : 'bg-black/20 border-white/5 text-gray-500'}`}>Scene/BG</button>
              </div>

              <div className="space-y-2">
                 <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Prompt Input</label>
                 <textarea 
                   className="w-full bg-black border border-white/10 p-4 rounded-xl h-24 focus:border-indigo-500 outline-none text-sm font-bold shadow-inner" 
                   placeholder="A cybernetic samurai, cinematic lighting..." 
                   value={prompt} 
                   onChange={(e) => setPrompt(e.target.value)} 
                 />
              </div>

              <div className="flex gap-2">
                <button onClick={async () => setPrompt(await aiService.enhancePrompt(prompt))} className="bg-[#222] px-5 py-3 rounded-xl text-gray-400 hover:text-indigo-400 transition-colors"><Sparkles size={16}/></button>
                <button onClick={handleAIProduction} disabled={isGenerating} className="flex-1 bg-indigo-600 py-3 rounded-xl text-xs font-black uppercase shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:bg-indigo-500 transition-colors">Start Rendering</button>
              </div>

              {aiPreview && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="dark-transparency-grid aspect-video rounded-xl border border-white/5 flex items-center justify-center p-2 bg-black/40 shadow-inner relative overflow-hidden">
                     <img src={aiPreview} className="max-w-full max-h-full object-contain" alt="ai render"/>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAiPreview(null)} className="flex-1 bg-black/40 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400">Discard</button>
                    <button onClick={() => {
                       if (!aiPreview || !targetPanelId) return;
                       const p = project.panels.find(p => p.id === targetPanelId);
                       if (!p) return;
                       const layer: Layer = {
                         id: `l${Date.now()}`, type: aiAssetType === 'character' ? LayerType.CHARACTER : LayerType.BACKGROUND,
                         name: `Asset_${Date.now().toString().slice(-4)}`, content: aiPreview, x: 50, y: 50, scale: 0.6, rotation: 0, opacity: 1, zIndex: p.layers.length + 1
                       };
                       updatePanel(targetPanelId, { layers: [...p.layers, layer] });
                       setAiPreview(null); setShowAIWindow(false);
                    }} className="flex-[2] bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500">Place in Panel {targetPanelId?.slice(-4)}</button>
                  </div>
                </div>
              )}
           </div>
        </FloatingWindow>
      )}

      {/* Settings Modal */}
      {showSettingsWindow && (
        <FloatingWindow title="STUDIO CONFIGURATION" onClose={() => setShowSettingsWindow(false)} width="w-[400px]">
           <div className="space-y-6">
              <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">A1111 Connectivity</label>
                 <div className="space-y-4 bg-black/40 p-4 rounded-xl border border-white/5">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-gray-500 uppercase">API URL</label>
                       <input type="text" className="w-full bg-black p-3 rounded-lg border border-white/5 text-xs font-bold text-indigo-400" value={aiSettings.endpoint} onChange={e => setAiSettings({...aiSettings, endpoint: e.target.value})} placeholder="http://127.0.0.1:7860" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-500 uppercase">Steps</label>
                          <input type="number" className="w-full bg-black p-3 rounded-lg border border-white/5 text-xs font-bold" value={aiSettings.steps} onChange={e => setAiSettings({...aiSettings, steps: +e.target.value})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-500 uppercase">CFG Scale</label>
                          <input type="number" className="w-full bg-black p-3 rounded-lg border border-white/5 text-xs font-bold" value={aiSettings.cfgScale} onChange={e => setAiSettings({...aiSettings, cfgScale: +e.target.value})} />
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </FloatingWindow>
      )}

      {/* Context Menus */}
      {contextMenu && (
        <div className="fixed bg-[#1a1a1a] border border-[#333] shadow-2xl rounded-xl z-[2000] w-56 flex flex-col p-1.5 animate-in zoom-in duration-100" style={{ left: contextMenu.x, top: contextMenu.y }}>
           {contextMenu.type === 'panel' ? (
             <>
                <div className="px-3 py-2 mb-1 text-[8px] font-black uppercase text-gray-500 bg-white/5 rounded-lg border border-white/5 tracking-[0.2em]">Target: {contextMenu.panelId?.slice(-4)}</div>
                <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiAssetType('character'); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-lg font-bold group"><UserIcon size={14} className="group-hover:text-indigo-400"/> New Character Hero</button>
                <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiAssetType('background'); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-lg font-bold group"><Mountain size={14} className="group-hover:text-indigo-400"/> New Scene Environment</button>
                <div className="h-px bg-white/5 my-1"></div>
                <button onClick={() => { setProject(p => ({...p, panels: p.panels.filter(pan => pan.id !== contextMenu.panelId)})); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-red-500/10 text-red-500 rounded-lg font-bold"><XCircle size={14}/> Delete Panel</button>
             </>
           ) : (
             <>
                <button onClick={() => { addPanel(); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-white/5 rounded-lg font-bold"><Plus size={14}/> Add New Panel</button>
                <button onClick={() => { setShowPresetsWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-white/5 rounded-lg font-bold"><Layout size={14}/> Change Layout Size</button>
             </>
           )}
        </div>
      )}

      {/* Preset Modal */}
      {showPresetsWindow && (
        <FloatingWindow title="PAGE PRESETS" onClose={() => setShowPresetsWindow(false)} width="w-72">
           <div className="space-y-2">
              {Object.entries(PAGE_PRESETS).map(([key, val]) => (
                <button key={key} onClick={() => {
                   setProject(prev => ({ ...prev, width: val.width, height: val.height, title: val.name }));
                   setShowPresetsWindow(false);
                }} className="w-full bg-black/40 p-4 rounded-xl border border-white/5 hover:border-indigo-500 transition-all flex items-center gap-4 group">
                   <div className="w-8 h-8 rounded bg-[#111] flex items-center justify-center group-hover:bg-indigo-600 transition-colors"><Layout size={16}/></div>
                   <div className="text-left"><div className="text-[10px] font-black uppercase tracking-widest">{val.name}</div><div className="text-[8px] text-gray-600">{val.width} x {val.height} PX</div></div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}
    </div>
  );
};

// --- Sub-Components ---
const PanelItem = memo(({ panel, isSelected, isTarget, onPointerDown, onContextMenu }: any) => {
  return (
    <div 
      onPointerDown={(e) => onPointerDown(e, panel.id)}
      onContextMenu={(e) => onContextMenu(e, panel.id)}
      className={`absolute cursor-move touch-none overflow-hidden transition-all duration-300
        ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-2 z-[50] shadow-2xl' : 'z-[10]'}
        ${isTarget ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
      style={{ 
        left: panel.x, top: panel.y, width: panel.width, height: panel.height, 
        transform: `rotate(${panel.rotation}deg)`, border: `${panel.borderThickness}px solid ${panel.borderColor}`, 
        backgroundColor: panel.backgroundColor,
        boxShadow: panel.shadowIntensity > 0 ? `0 ${panel.shadowIntensity}px ${panel.shadowIntensity * 2}px rgba(0,0,0,0.3)` : 'none'
      }}
    >
      {[...panel.layers].sort((a,b) => a.zIndex - b.zIndex).map(layer => (
        <div key={layer.id} className="absolute pointer-events-auto" style={{ 
          left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.scale * 100}%`, 
          transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scaleX(${layer.flipX ? -1 : 1})`, 
          opacity: layer.opacity, zIndex: layer.zIndex, filter: layer.filter || 'none'
        }}>
          {layer.type === LayerType.TEXT_BUBBLE ? (
            <div className="relative min-w-[120px] min-h-[80px]">
              <SpeechBubble type={layer.bubbleType || 'speech'} tailX={layer.tailX} tailY={layer.tailY} />
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center comic-font text-black" style={{ fontSize: layer.fontSize }}>{layer.content}</div>
            </div>
          ) : <img src={layer.content} alt={layer.name} className="w-full h-auto pointer-events-none" />}
        </div>
      ))}
    </div>
  );
});

const Knob = memo(({ value, onChange, label }: { value: number, onChange: (val: number) => void, label: string }) => {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!knobRef.current) return;
      const rect = knobRef.current.getBoundingClientRect();
      const angle = Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)) * (180 / Math.PI);
      onChange(Math.round(angle));
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging, onChange]);

  return (
    <div className="flex flex-col items-center gap-2">
      <label className="text-[8px] text-gray-500 uppercase font-black">{label}</label>
      <div ref={knobRef} onMouseDown={() => setIsDragging(true)} className="relative w-14 h-14 rounded-full bg-[#111] border-2 border-[#333] cursor-pointer flex items-center justify-center shadow-inner hover:border-indigo-500 transition-colors">
        <div className="absolute w-1 h-5 bg-indigo-500 rounded-full origin-bottom -translate-y-2.5" style={{ transform: `rotate(${value}deg) translateY(-6px)` }} />
        <span className="text-[9px] font-mono text-gray-400">{value}°</span>
      </div>
    </div>
  );
});

const PanelProps = ({ panel, onUpdate }: any) => (
  <div className="space-y-4">
    <label className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em]">Geometry</label>
    <div className="grid grid-cols-2 gap-4">
       <div className="space-y-1"><label className="text-[8px] text-gray-500 uppercase font-black">Width</label><input type="number" className="w-full bg-black p-3 rounded-lg border border-white/5 text-xs font-bold" value={panel.width} onChange={e => onUpdate({width: +e.target.value})} /></div>
       <div className="space-y-1"><label className="text-[8px] text-gray-500 uppercase font-black">Height</label><input type="number" className="w-full bg-black p-3 rounded-lg border border-white/5 text-xs font-bold" value={panel.height} onChange={e => onUpdate({height: +e.target.value})} /></div>
    </div>
    <div className="flex justify-center py-6 bg-black/40 rounded-xl border border-white/5"><Knob label="Canvas Spin" value={panel.rotation} onChange={v => onUpdate({rotation: v})} /></div>
  </div>
);

const LayerProps = ({ layer, onUpdate }: any) => (
  <div className="space-y-4 animate-in slide-in-from-right-2">
    <label className="text-[9px] font-black uppercase text-yellow-500 tracking-[0.2em]">Asset Properties</label>
    <div className="space-y-2">
       <div className="flex justify-between text-[8px] uppercase text-gray-600 font-black">Scale Factor: {layer.scale.toFixed(2)}X</div>
       <input type="range" min="0.1" max="5" step="0.1" value={layer.scale} onChange={e => onUpdate({scale: +e.target.value})} className="w-full accent-yellow-500 h-1 bg-[#333] rounded-full appearance-none cursor-pointer" />
    </div>
    <div className="flex justify-center py-6 bg-black/40 rounded-xl border border-white/5"><Knob label="Asset Angle" value={layer.rotation} onChange={v => onUpdate({rotation: v})} /></div>
    <div className="flex gap-2">
       <button onClick={() => onUpdate({flipX: !layer.flipX})} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase border transition-all ${layer.flipX ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-black/40 border-white/5 text-gray-500 hover:text-white'}`}>Mirror H</button>
       <button onClick={() => onUpdate({zIndex: layer.zIndex + 1})} className="flex-1 bg-black/40 p-3 rounded-lg text-[9px] font-black hover:bg-white/5 uppercase text-gray-400">Layer Up</button>
       <button onClick={() => onUpdate({zIndex: Math.max(0, layer.zIndex - 1)})} className="flex-1 bg-black/40 p-3 rounded-lg text-[9px] font-black hover:bg-white/5 uppercase text-gray-400">Layer Down</button>
    </div>
  </div>
);

const ToolbarBtn = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3.5 rounded-xl relative group transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 scale-110' : 'hover:bg-white/5 text-gray-500 hover:text-white'}`}>
    {icon}
    <span className="absolute left-full ml-4 bg-[#1a1a1a] p-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hidden group-hover:block z-[500] border border-white/5 shadow-2xl whitespace-nowrap">{label}</span>
  </button>
);

const MousePointer2 = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>;

export default App;
