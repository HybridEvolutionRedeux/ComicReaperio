
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Type, Square, Layout, ZoomIn, ZoomOut,
  Mountain, User as UserIcon, Sparkles, 
  XCircle, FileImage, Cpu, Globe, Zap, RefreshCw, 
  CheckCircle2, AlertCircle, FolderOpen, HardDrive
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

const STORAGE_KEY = 'comiccraft_studio_session_v6';

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
    steps: 25,
    cfgScale: 7,
    sampler: 'Euler a',
    removeBackground: true,
    bgRemovalEngine: 'gemini',
    loras: [],
    checkpointFolderPath: '',
    loraFolderPath: ''
  });

  const [sdOnline, setSdOnline] = useState<boolean | null>(null);
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

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);

  const refreshLocalAssets = useCallback(async () => {
    const isOnline = await aiService.checkSDStatus(aiSettings.endpoint);
    setSdOnline(isOnline);
    if (isOnline) {
      const models = await aiService.fetchA1111Models(aiSettings.endpoint);
      const loras = await aiService.fetchA1111Loras(aiSettings.endpoint);
      setAvailableModels(models);
      setAvailableLoras(loras);
      if (models.length > 0 && !aiSettings.model) {
        setAiSettings(s => ({ ...s, model: models[0] }));
      }
    }
  }, [aiSettings.endpoint, aiSettings.model]);

  useEffect(() => {
    refreshLocalAssets();
    const interval = setInterval(refreshLocalAssets, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [refreshLocalAssets]);

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
        setAiActionLabel(`Removing BG (${aiSettings.bgRemovalEngine})...`);
        img = await aiService.removeBackground(img, aiSettings);
      }
      setAiPreview(img);
    } catch (e: any) { 
      alert(e.message || "Production failed."); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] select-none overflow-hidden text-gray-200 font-sans">
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
           <ToolbarBtn icon={<Settings size={20}/>} label="Studio Settings" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
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
            <div className="text-white text-xs font-black uppercase tracking-[0.4em] mb-1">{aiActionLabel}</div>
          </div>
        )}
      </div>

      {/* AI Production Studio */}
      {showAIWindow && (
        <FloatingWindow title="AI PRODUCTION STUDIO" onClose={() => setShowAIWindow(false)} width="w-[540px]">
           <div className="space-y-5">
              <div className="flex p-1 bg-black/40 rounded-xl gap-1">
                 <button onClick={() => setAiSettings(s => ({...s, backend: 'gemini'}))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiSettings.backend === 'gemini' ? 'bg-indigo-600 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Globe size={14}/> Gemini</button>
                 <button onClick={() => setAiSettings(s => ({...s, backend: 'automatic1111'}))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiSettings.backend === 'automatic1111' ? 'bg-indigo-600 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Cpu size={14}/> SD Local</button>
              </div>

              {aiSettings.backend === 'automatic1111' && (
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       {sdOnline ? <CheckCircle2 size={12} className="text-green-500"/> : <AlertCircle size={12} className="text-red-500"/>}
                       <span className={`text-[8px] font-black uppercase ${sdOnline ? 'text-green-500' : 'text-red-500'}`}>Hardware: {sdOnline ? 'Online' : 'Offline'}</span>
                     </div>
                     <button onClick={refreshLocalAssets} className="text-indigo-400"><RefreshCw size={14}/></button>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold text-gray-600 uppercase">Model</label>
                        <select className="w-full bg-black border border-white/10 p-2 rounded text-[10px] font-bold text-indigo-400 outline-none" value={aiSettings.model} onChange={(e) => setAiSettings(s => ({ ...s, model: e.target.value }))}>
                          {availableModels.map(m => <option key={m} value={m}>{m.split('/').pop()}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold text-gray-600 uppercase">Sampler</label>
                        <select className="w-full bg-black border border-white/10 p-2 rounded text-[10px] font-bold text-indigo-400 outline-none" value={aiSettings.sampler} onChange={(e) => setAiSettings(s => ({ ...s, sampler: e.target.value }))}>
                          <option value="Euler a">Euler a</option>
                          <option value="DPM++ 2M Karras">DPM++ 2M Karras</option>
                        </select>
                     </div>
                   </div>
                </div>
              )}

              <div className="flex items-center justify-between px-2">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="hidden" checked={aiSettings.removeBackground} onChange={e => setAiSettings({...aiSettings, removeBackground: e.target.checked})} />
                    <div className={`w-4 h-4 rounded border transition-colors ${aiSettings.removeBackground ? 'bg-indigo-600 border-indigo-500' : 'border-white/20'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Auto-Alpha Removal</span>
                  </label>
                </div>
                {aiSettings.removeBackground && (
                  <div className="flex bg-black/40 p-1 rounded-lg">
                    <button onClick={() => setAiSettings({...aiSettings, bgRemovalEngine: 'gemini'})} className={`px-3 py-1 rounded text-[8px] font-black uppercase ${aiSettings.bgRemovalEngine === 'gemini' ? 'bg-indigo-600' : 'text-gray-500'}`}>Gemini</button>
                    <button onClick={() => setAiSettings({...aiSettings, bgRemovalEngine: 'rembg'})} className={`px-3 py-1 rounded text-[8px] font-black uppercase ${aiSettings.bgRemovalEngine === 'rembg' ? 'bg-indigo-600' : 'text-gray-500'}`}>Rembg (Local)</button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                 <button onClick={() => setAiAssetType('character')} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase border transition-all ${aiAssetType === 'character' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-400' : 'bg-black/20 border-white/5 text-gray-500'}`}>Character Sprite</button>
                 <button onClick={() => setAiAssetType('background')} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase border transition-all ${aiAssetType === 'background' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-400' : 'bg-black/20 border-white/5 text-gray-500'}`}>Full Scene</button>
              </div>

              <div className="space-y-2">
                 <textarea className="w-full bg-black border border-white/10 p-4 rounded-xl h-24 focus:border-indigo-500 outline-none text-sm font-bold" placeholder="Visual description..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>

              <button onClick={handleAIProduction} disabled={isGenerating} className="w-full bg-indigo-600 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-lg hover:bg-indigo-500 transition-colors">Generate Render</button>

              {aiPreview && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="dark-transparency-grid aspect-video rounded-xl border border-white/5 flex items-center justify-center p-2 bg-black/40 shadow-inner">
                     <img src={aiPreview} className="max-w-full max-h-full object-contain" alt="ai render"/>
                  </div>
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
                  }} className="w-full bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500">Add to Current Panel</button>
                </div>
              )}
           </div>
        </FloatingWindow>
      )}

      {/* Studio Settings Window */}
      {showSettingsWindow && (
        <FloatingWindow title="LOCAL HARDWARE SETUP" onClose={() => setShowSettingsWindow(false)} width="w-[440px]">
           <div className="space-y-6">
              <div className="space-y-4 bg-black/40 p-5 rounded-xl border border-white/5">
                 <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2"><Cpu size={16} className="text-indigo-400"/><span className="text-[10px] font-black uppercase tracking-widest">Automatic1111 Connection</span></div>
                   <div className={`px-2 py-0.5 rounded text-[8px] font-black ${sdOnline ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{sdOnline ? 'READY' : 'OFFLINE'}</div>
                 </div>
                 
                 <div className="space-y-3">
                    <div className="space-y-1">
                       <label className="text-[8px] font-black text-gray-500 uppercase">Local API Base URL</label>
                       <div className="flex gap-2">
                         <input type="text" className="flex-1 bg-black p-3 rounded-lg border border-white/5 text-xs font-bold text-indigo-400" value={aiSettings.endpoint} onChange={e => setAiSettings({...aiSettings, endpoint: e.target.value})} />
                         <button onClick={refreshLocalAssets} className="bg-white/5 p-3 rounded-lg hover:bg-white/10"><RefreshCw size={14}/></button>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-500 uppercase flex items-center gap-1"><FolderOpen size={10}/> Checkpoint Folder</label>
                          <input type="text" className="w-full bg-black p-2 rounded-lg border border-white/5 text-[9px] font-mono text-gray-400" placeholder="E:/SD/models/Stable-diffusion" value={aiSettings.checkpointFolderPath} onChange={e => setAiSettings({...aiSettings, checkpointFolderPath: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-500 uppercase flex items-center gap-1"><FolderOpen size={10}/> LoRA Folder</label>
                          <input type="text" className="w-full bg-black p-2 rounded-lg border border-white/5 text-[9px] font-mono text-gray-400" placeholder="E:/SD/models/Lora" value={aiSettings.loraFolderPath} onChange={e => setAiSettings({...aiSettings, loraFolderPath: e.target.value})} />
                       </div>
                    </div>

                    <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                       <p className="text-[9px] text-indigo-400 leading-relaxed">
                         <AlertCircle size={10} className="inline mr-1 mb-0.5"/> 
                         To enable background removal, ensure the <span className="font-black">sd-webui-rembg</span> extension is installed and active on your local instance.
                       </p>
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Hardware Metadata</label>
                 <div className="grid grid-cols-2 gap-2">
                   <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                     <span className="text-[8px] font-black uppercase text-gray-600">Models Loaded</span>
                     <span className="text-xs font-black text-indigo-400">{availableModels.length}</span>
                   </div>
                   <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                     <span className="text-[8px] font-black uppercase text-gray-600">LoRAs Ready</span>
                     <span className="text-xs font-black text-indigo-400">{availableLoras.length}</span>
                   </div>
                 </div>
              </div>
           </div>
        </FloatingWindow>
      )}

      {/* Context Menus */}
      {contextMenu && (
        <div className="fixed bg-[#1a1a1a] border border-[#333] shadow-2xl rounded-xl z-[2000] w-56 flex flex-col p-1.5 animate-in zoom-in duration-100" style={{ left: contextMenu.x, top: contextMenu.y }}>
           <div className="px-3 py-2 mb-1 text-[8px] font-black uppercase text-gray-500 bg-white/5 rounded-lg">Target Panel: {contextMenu.panelId?.slice(-4)}</div>
           <button onClick={() => { setTargetPanelId(contextMenu.panelId!); setAiAssetType('character'); setShowAIWindow(true); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-indigo-600/10 rounded-lg font-bold group"><UserIcon size={14} className="group-hover:text-indigo-400"/> Generate Asset</button>
           <button onClick={() => { setProject(p => ({...p, panels: p.panels.filter(pan => pan.id !== contextMenu.panelId)})); setContextMenu(null); }} className="flex items-center gap-3 p-3 text-xs hover:bg-red-500/10 text-red-500 rounded-lg font-bold"><XCircle size={14}/> Delete Panel</button>
        </div>
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
          opacity: layer.opacity, zIndex: layer.zIndex
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

const ToolbarBtn = ({ icon, label, onClick, active }: any) => (
  <button onClick={onClick} className={`p-3.5 rounded-xl relative group transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 scale-110' : 'hover:bg-white/5 text-gray-500 hover:text-white'}`}>
    {icon}
    <span className="absolute left-full ml-4 bg-[#1a1a1a] p-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hidden group-hover:block z-[500] border border-white/5 shadow-2xl whitespace-nowrap">{label}</span>
  </button>
);

export default App;
