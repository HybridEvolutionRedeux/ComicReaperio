
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Grid3X3, Zap, RefreshCw, 
  MessageSquare, Box, File, X, Monitor, BookOpen, 
  Type, MousePointer2, Check, AlertCircle, List, PlusCircle, Play, 
  Palette, Ghost, Sparkles, Image as ImageIcon, Loader2, ArrowUp, ArrowDown, RotateCcw, Trash2, ZoomIn, ZoomOut, FilePlus, Square, LayoutDashboard
} from 'lucide-react';
import { ComicProject, Page, Panel, Layer, LayerType, AISettings } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import { FONT_PRESETS, GRADIENT_PRESETS, COLORS } from './constants';
import { RotationKnob, PropertySlider, PropertyField, ToolbarBtn } from './components/UIElements';
import { PanelItem } from './components/PanelItem';
import { ContextMenu } from './components/ContextMenu';
import * as aiService from './services/aiService';
import html2canvas from 'html2canvas';

const PAGE_PRESETS = {
  US_COMIC: { width: 1200, height: 1800, name: 'US Comic Standard', category: 'Comic', icon: <BookOpen size={16}/> },
  MANGA_A5: { width: 1000, height: 1414, name: 'Manga A5', category: 'Comic', icon: <BookOpen size={16}/> },
  TCG_CARD: { width: 750, height: 1050, name: 'TCG Game Card', category: 'Game', icon: <ImageIcon size={16}/> },
};

const PANEL_TEMPLATES = [
  { 
    name: '2-Panel Vertical', 
    icon: <div className="grid grid-rows-2 gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20" /><div className="bg-white/20" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Panel 1', x: 50, y: 50, width: w - 100, height: h / 2 - 75 },
      { id: 'tp2', title: 'Panel 2', x: 50, y: h / 2 + 25, width: w - 100, height: h / 2 - 75 },
    ]
  },
  { 
    name: '3-Panel Stack', 
    icon: <div className="grid grid-rows-3 gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Panel 1', x: 50, y: 50, width: w - 100, height: h / 3 - 60 },
      { id: 'tp2', title: 'Panel 2', x: 50, y: h / 3 + 20, width: w - 100, height: h / 3 - 60 },
      { id: 'tp3', title: 'Panel 3', x: 50, y: (h / 3) * 2 + 20, width: w - 100, height: h / 3 - 60 },
    ]
  },
  { 
    name: '4-Panel Grid', 
    icon: <div className="grid grid-cols-2 grid-rows-2 gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Panel 1', x: 50, y: 50, width: w / 2 - 75, height: h / 2 - 75 },
      { id: 'tp2', title: 'Panel 2', x: w / 2 + 25, y: 50, width: w / 2 - 75, height: h / 2 - 75 },
      { id: 'tp3', title: 'Panel 3', x: 50, y: h / 2 + 25, width: w / 2 - 75, height: h / 2 - 75 },
      { id: 'tp4', title: 'Panel 4', x: w / 2 + 25, y: h / 2 + 25, width: w / 2 - 75, height: h / 2 - 75 },
    ]
  },
  { 
    name: '6-Grid Classic', 
    icon: <div className="grid grid-cols-2 grid-rows-3 gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /><div className="bg-white/20" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Panel 1', x: 50, y: 50, width: w / 2 - 75, height: h / 3 - 50 },
      { id: 'tp2', title: 'Panel 2', x: w / 2 + 25, y: 50, width: w / 2 - 75, height: h / 3 - 50 },
      { id: 'tp3', title: 'Panel 3', x: 50, y: h / 3 + 25, width: w / 2 - 75, height: h / 3 - 50 },
      { id: 'tp4', title: 'Panel 4', x: w / 2 + 25, y: h / 3 + 25, width: w / 2 - 75, height: h / 3 - 50 },
      { id: 'tp5', title: 'Panel 5', x: 50, y: (h / 3) * 2 + 25, width: w / 2 - 75, height: h / 3 - 50 },
      { id: 'tp6', title: 'Panel 6', x: w / 2 + 25, y: (h / 3) * 2 + 25, width: w / 2 - 75, height: h / 3 - 50 },
    ]
  },
  { 
    name: 'Cinematic Wide', 
    icon: <div className="grid grid-rows-3 gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20" /><div className="bg-white/20 h-full scale-y-125" /><div className="bg-white/20" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Cinematic', x: 50, y: h / 4, width: w - 100, height: h / 2, panelStyle: 'borderless' as const },
    ]
  },
  { 
    name: 'Hero Splash', 
    icon: <div className="grid grid-cols-3 gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20" /><div className="bg-white/20 h-full scale-x-125" /><div className="bg-white/20" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Side 1', x: 50, y: 50, width: w / 4, height: h - 100 },
      { id: 'tp2', title: 'HERO', x: w / 4 + 75, y: 100, width: w / 2 - 150, height: h - 200, panelStyle: 'action' as const },
      { id: 'tp3', title: 'Side 2', x: (w / 4) * 3 + 25, y: 50, width: w / 4 - 75, height: h - 100 },
    ]
  },
  { 
    name: 'Dynamic Action', 
    icon: <div className="flex gap-1 w-6 h-6 border border-white/20 p-0.5"><div className="bg-white/20 w-1/3 skew-y-6" /><div className="bg-white/20 flex-1 -skew-y-3" /></div>,
    panels: (w: number, h: number) => [
      { id: 'tp1', title: 'Panel 1', x: 50, y: 50, width: w - 100, height: h / 3, panelStyle: 'action' as const },
      { id: 'tp2', title: 'Panel 2', x: 50, y: h / 3 + 100, width: w / 2 - 75, height: (h / 3) * 2 - 200, panelStyle: 'standard' as const },
      { id: 'tp3', title: 'Panel 3', x: w / 2 + 25, y: h / 3 + 100, width: w / 2 - 75, height: (h / 3) * 2 - 200, panelStyle: 'standard' as const },
    ]
  }
];

const STORAGE_KEY = 'comiccraft_studio_v30';

const App: React.FC = () => {
  const [project, setProject] = useState<ComicProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
      return { 
        id: '1', title: 'New Comic', author: 'Artist', 
        pages: [{ id: 'pg1', name: 'Cover', width: 1200, height: 1800, category: 'Comic', backgroundColor: '#ffffff', panels: [] }],
        currentPageIndex: 0, zoom: 0.4, lastModified: Date.now() 
      };
    } catch {
      return { id: '1', title: 'New Comic', author: 'Artist', pages: [{ id: 'pg1', name: 'Cover', width: 1200, height: 1800, category: 'Comic', backgroundColor: '#ffffff', panels: [] }], currentPageIndex: 0, zoom: 0.4, lastModified: Date.now() };
    }
  });

  const currentPage = project.pages[project.currentPageIndex] || project.pages[0];

  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_settings`);
    return saved ? JSON.parse(saved) : {
      backend: 'gemini', endpoint: 'http://127.0.0.1:7860', apiKey: '', model: '', negativePrompt: '', stylePreset: 'Golden Age', steps: 25, cfgScale: 7, sampler: 'Euler a', removeBackground: true, bgRemovalEngine: 'gemini', loras: [], checkpointFolderPath: '', loraFolderPath: ''
    };
  });

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'explorer' | 'lettering' | 'storyboard'>('explorer');
  const [autoInject, setAutoInject] = useState(true);
  
  // Daisychain Multi-Prompt State
  const [panelScripts, setPanelScripts] = useState<Record<string, string[]>>({});
  const [forgeTab, setForgeTab] = useState<'single' | 'script'>('single');
  const [processingPanelId, setProcessingPanelId] = useState<string | null>(null);
  
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [showTemplatesWindow, setShowTemplatesWindow] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Studio Ready.");
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, panelId: string, layerId: string | null } | null>(null);
  
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showAIWindow && selectedPanelId) setTargetPanelId(selectedPanelId);
  }, [showAIWindow, selectedPanelId]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(aiSettings)); }, [aiSettings]);

  const updateCurrentPage = useCallback((updates: Partial<Page>) => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      pages[pageIndex] = { ...pages[pageIndex], ...updates };
      return { ...prev, pages };
    });
  }, []);

  const applyPanelTemplate = (template: typeof PANEL_TEMPLATES[0]) => {
    const generatedPanels = template.panels(currentPage.width, currentPage.height).map((p, idx) => ({
      ...p,
      id: `p_${Date.now()}_${idx}`,
      rotation: 0,
      zIndex: idx + 1,
      borderThickness: 4,
      borderColor: '#000000',
      borderOpacity: 1,
      shadowIntensity: 4,
      backgroundColor: '#ffffff',
      borderRadius: 0,
      panelStyle: (p as any).panelStyle || 'standard',
      layers: []
    }));

    updateCurrentPage({ panels: [...currentPage.panels, ...generatedPanels] });
    setShowTemplatesWindow(false);
    setStatusMessage(`Applied ${template.name} Template.`);
  };

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      const page = { ...pages[pageIndex] };
      page.panels = page.panels.map(p => p.id === id ? { ...p, ...updates } : p);
      pages[pageIndex] = page;
      return { ...prev, pages };
    });
  }, []);

  const removePanel = useCallback((id: string) => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      const page = { ...pages[pageIndex] };
      page.panels = page.panels.filter(p => p.id !== id);
      pages[pageIndex] = page;
      return { ...prev, pages };
    });
    // Ensure selection is cleared if the deleted panel was selected
    setSelectedPanelId(prev => prev === id ? null : prev);
  }, []);

  const updateLayer = useCallback((pId: string, lId: string, updates: Partial<Layer>) => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      const page = { ...pages[pageIndex] };
      page.panels = page.panels.map(p => {
        if (p.id !== pId) return p;
        const recursiveUpdate = (ls: Layer[]): Layer[] => ls.map(l => {
          if (l.id === lId) return { ...l, ...updates };
          if (l.children) return { ...l, children: recursiveUpdate(l.children) };
          return l;
        });
        return { ...p, layers: recursiveUpdate(p.layers) };
      });
      pages[pageIndex] = page;
      return { ...prev, pages };
    });
  }, []);

  const removeLayer = useCallback((pId: string, lId: string) => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      const page = { ...pages[pageIndex] };
      page.panels = page.panels.map(p => {
        if (p.id !== pId) return p;
        const recursiveFilter = (ls: Layer[]): Layer[] => ls.filter(l => l.id !== lId);
        return { ...p, layers: recursiveFilter(p.layers) };
      });
      pages[pageIndex] = page;
      return { ...prev, pages };
    });
    // Ensure selection is cleared if the deleted layer was selected
    setSelectedLayerId(prev => prev === lId ? null : prev);
  }, []);

  const changeLayerZ = useCallback((pId: string, lId: string, direction: 'up' | 'down') => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      const page = { ...pages[pageIndex] };
      page.panels = page.panels.map(p => {
        if (p.id !== pId) return p;
        const layers = [...p.layers];
        const layerIdx = layers.findIndex(l => l.id === lId);
        if (layerIdx === -1) return p;
        const currentZ = layers[layerIdx].zIndex;
        layers[layerIdx] = { ...layers[layerIdx], zIndex: direction === 'up' ? currentZ + 1 : currentZ - 1 };
        return { ...p, layers };
      });
      pages[pageIndex] = page;
      return { ...prev, pages };
    });
  }, []);

  const injectLayerIntoPanel = useCallback((pId: string, content: string, name = 'AI Asset', type = LayerType.CHARACTER) => {
    setProject(prev => {
      const pageIndex = prev.currentPageIndex;
      const pages = [...prev.pages];
      const page = { ...pages[pageIndex] };
      const panelIndex = page.panels.findIndex(p => p.id === pId);
      if (panelIndex === -1) return prev;

      const p = { ...page.panels[panelIndex] };
      const newLayer: Layer = {
        id: `l_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type,
        name,
        content,
        x: 50, y: 50, scale: 1, rotation: 0, opacity: 1,
        zIndex: (p.layers?.length || 0) + 1,
        font: 'Bangers', fontSize: 24, color: '#000000'
      };

      const newPanels = [...page.panels];
      newPanels[panelIndex] = { ...p, layers: [...(p.layers || []), newLayer] };
      page.panels = newPanels;
      pages[pageIndex] = page;
      return { ...prev, pages };
    });
  }, []);

  const handleAIProduction = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setStatusMessage("Forge engines firing...");
    
    try {
      if (forgeTab === 'single') {
        if (!targetPanelId || !prompt) throw new Error("Need target and prompt.");
        setProcessingPanelId(targetPanelId);
        const enhanced = await aiService.enhancePrompt(prompt);
        let img = await aiService.generateImage(enhanced, aiSettings);
        if (aiSettings.removeBackground) img = await aiService.removeBackground(img, aiSettings);
        
        if (autoInject) {
          injectLayerIntoPanel(targetPanelId, img);
          setStatusMessage("Asset forged and injected.");
        } else {
          setAiPreview(img);
          setStatusMessage("Vision complete. Review preview.");
        }
      } else {
        const panelsWithScript = currentPage.panels.filter(p => (panelScripts[p.id] || []).some(s => s.trim()));
        if (panelsWithScript.length === 0) throw new Error("No script content found.");

        for (const p of panelsWithScript) {
          setProcessingPanelId(p.id);
          const scripts = panelScripts[p.id] || [];
          for (let i = 0; i < scripts.length; i++) {
            const currentPrompt = scripts[i];
            if (!currentPrompt.trim()) continue;
            
            setStatusMessage(`Forging: ${p.title} (Layer ${i+1}/${scripts.length})`);
            const enhanced = await aiService.enhancePrompt(currentPrompt);
            let img = await aiService.generateImage(enhanced, aiSettings);
            if (aiSettings.removeBackground) img = await aiService.removeBackground(img, aiSettings);
            injectLayerIntoPanel(p.id, img, `Daisychain: ${p.title} #${i+1}`);
          }
        }
        setStatusMessage("Daisychain sequence finalized.");
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`Forge Error: ${e.message}`);
    } finally {
      setIsGenerating(false);
      setProcessingPanelId(null);
    }
  };

  const handleAddPromptToScript = (pId: string) => {
    setPanelScripts(prev => ({
      ...prev,
      [pId]: [...(prev[pId] || ['']), '']
    }));
  };

  const handleUpdateScriptPrompt = (pId: string, index: number, val: string) => {
    setPanelScripts(prev => {
      const current = [...(prev[pId] || [''])];
      current[index] = val;
      return { ...prev, [pId]: current };
    });
  };

  const addTextAsset = (bubbleType: 'speech' | 'thought' | 'shout' | 'whisper' | 'narration') => {
    if (!selectedPanelId) {
      setStatusMessage("Select a panel first!");
      return;
    }
    const type = bubbleType === 'narration' ? LayerType.NARRATION : LayerType.TEXT_BUBBLE;
    injectLayerIntoPanel(selectedPanelId, "Text...", `Lettering: ${bubbleType}`, type);
    setInspectorTab('explorer');
  };

  const selectedPanel = currentPage.panels.find(p => p.id === selectedPanelId);
  const selectedLayer = selectedPanel?.layers.find(l => l.id === selectedLayerId);

  return (
    <div className="flex h-screen w-screen bg-[#050505] select-none overflow-hidden text-gray-400 font-sans flex-col" onPointerDown={() => setContextMenu(null)}>
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR TOOLBAR */}
        <div className="w-14 bg-[#111111] border-r border-white/5 flex flex-col items-center py-5 gap-6 z-[100]">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-500 shadow-xl transition-all"><Monitor size={20} className="text-white" /></div>
          <div className="h-px w-6 bg-white/10" />
          
          <ToolbarBtn icon={<Plus size={18}/>} label="New Panel" onClick={() => {
            const id = `p${Date.now()}`;
            updateCurrentPage({ panels: [...currentPage.panels, { id, title: `Panel ${currentPage.panels.length+1}`, x: 100, y: 100, width: 400, height: 300, rotation: 0, zIndex: currentPage.panels.length+1, borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4, backgroundColor: '#ffffff', borderRadius: 0, panelStyle: 'standard', layers: [] }] });
            setSelectedPanelId(id);
            setInspectorTab('explorer');
          }} />
          
          <ToolbarBtn icon={<LayoutDashboard size={18}/>} label="Panel Templates" onClick={() => setShowTemplatesWindow(true)} active={showTemplatesWindow} />
          <ToolbarBtn icon={<BookOpen size={18}/>} label="Storyboard" onClick={() => setInspectorTab('storyboard')} active={inspectorTab === 'storyboard'} />
          <ToolbarBtn icon={<Type size={18}/>} label="Lettering" onClick={() => setInspectorTab('lettering')} active={inspectorTab === 'lettering'} />
          <ToolbarBtn icon={<Wand2 size={18}/>} label="AI Forge" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
          
          <div className="mt-auto mb-4 flex flex-col gap-4">
             <ToolbarBtn icon={<Download size={18}/>} label="Export PNG" onClick={async () => {
                if (!workspaceRef.current) return;
                const canvas = await html2canvas(workspaceRef.current, { scale: 2 });
                const link = document.createElement('a');
                link.download = `comic_export_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
             }} />
             <ToolbarBtn icon={<Settings size={18}/>} label="Project Config" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="flex-1 flex flex-col bg-[#0a0a0a] relative">
          <div className="h-14 border-b border-white/5 flex items-center px-4 gap-2 bg-[#0d0d0d] overflow-x-auto custom-scrollbar no-scrollbar">
             {project.pages.map((pg, idx) => (
                <div key={pg.id} className={`flex items-center gap-3 px-6 py-2 rounded-t-xl cursor-pointer whitespace-nowrap transition-all ${project.currentPageIndex === idx ? 'bg-[#111] text-indigo-400 border-b-2 border-b-indigo-500 shadow-xl' : 'text-gray-500 hover:text-white'}`} onClick={() => setProject(p => ({...p, currentPageIndex: idx}))}>
                   <span className="text-[10px] font-black uppercase tracking-widest">{pg.name}</span>
                </div>
             ))}
             <button onClick={() => {
                const newPg = { id: `pg${Date.now()}`, name: `Page ${project.pages.length+1}`, width: 1200, height: 1800, category: 'Comic', backgroundColor: '#ffffff', panels: [] };
                setProject(prev => ({ ...prev, pages: [...prev.pages, newPg], currentPageIndex: prev.pages.length }));
             }} className="p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-full ml-2"><Plus size={16}/></button>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-auto custom-scrollbar" onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); }}>
            <div ref={workspaceRef} className="shadow-2xl relative transition-transform duration-200" style={{ width: currentPage.width, height: currentPage.height, background: currentPage.backgroundColor, transform: `scale(${project.zoom})` }}>
              <div className="absolute inset-0 dark-transparency-grid pointer-events-none opacity-20" />
              {currentPage.panels.map(p => (
                <PanelItem 
                  key={p.id} panel={p} 
                  isSelected={selectedPanelId === p.id} 
                  isTargeted={targetPanelId === p.id && showAIWindow}
                  isProcessing={processingPanelId === p.id}
                  selectedLayerId={selectedLayerId} 
                  multiSelectedLayerIds={[]}
                  onUpdateLayer={updateLayer} 
                  onContextMenu={(e, pid, lid) => setContextMenu({ x: e.clientX, y: e.clientY, panelId: pid, layerId: lid })} 
                  onLayerSelect={(lid) => setSelectedLayerId(lid)}
                  onPointerDown={(e: any) => { e.stopPropagation(); setSelectedPanelId(p.id); if (showAIWindow) setTargetPanelId(p.id); }} 
                />
              ))}
            </div>
            <div className="absolute bottom-8 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl z-50">
              <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="text-gray-400 hover:text-white transition-colors"><ZoomOut size={18} /></button>
              <span className="text-[10px] font-black w-16 text-center text-white tabular-nums">{Math.round(project.zoom * 100)}%</span>
              <button onClick={() => setProject(p => ({...p, zoom: Math.min(3, p.zoom + 0.1)}))} className="text-gray-400 hover:text-white transition-colors"><ZoomIn size={18}/></button>
            </div>
          </div>
        </div>

        {/* RIGHT INSPECTOR (RESTORED SECTIONS) */}
        <div className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col z-[100] shadow-2xl overflow-hidden">
           <div className="flex border-b border-white/5">
              {(['explorer', 'lettering', 'storyboard'] as const).map(tab => (
                 <button key={tab} onClick={() => setInspectorTab(tab)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${inspectorTab === tab ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/5' : 'text-gray-600 hover:text-gray-300'}`}>
                    {tab === 'explorer' && <Layers size={14} className="mx-auto mb-1"/>}
                    {tab === 'lettering' && <Type size={14} className="mx-auto mb-1"/>}
                    {tab === 'storyboard' && <Grid3X3 size={14} className="mx-auto mb-1"/>}
                    {tab}
                 </button>
              ))}
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {inspectorTab === 'explorer' && (
                 <div className="space-y-4">
                    {currentPage.panels.length === 0 && <div className="p-8 text-center text-[10px] uppercase font-black opacity-20 mt-10"><Box size={40} className="mx-auto mb-4"/> No Panels on Canvas</div>}
                    {currentPage.panels.map(panel => (
                      <div key={panel.id} className="space-y-1">
                        <div className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all group ${selectedPanelId === panel.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`} onClick={() => setSelectedPanelId(panel.id)}>
                          <Box size={14} />
                          <span className="text-[10px] font-black uppercase truncate flex-1">{panel.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); removePanel(panel.id); }} className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                        </div>
                        <div className="pl-4 space-y-1 border-l border-white/5 ml-3">
                          {panel.layers.map(layer => (
                            <div key={layer.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase transition-all group ${selectedLayerId === layer.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(layer.id); }}>
                               <File size={12} className="opacity-50" />
                               <span className="truncate flex-1">{layer.name}</span>
                               <button onClick={(e) => { e.stopPropagation(); removeLayer(panel.id, layer.id); }} className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                 </div>
              )}

              {inspectorTab === 'lettering' && (
                 <div className="space-y-6 pt-4">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest px-2">Lettering Library</h3>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { id: 'speech', label: 'Speech Bubble', icon: <MessageSquare size={18}/> },
                         { id: 'thought', label: 'Thought Cloud', icon: <Ghost size={18}/> },
                         { id: 'shout', label: 'Shout Spike', icon: <Zap size={18}/> },
                         { id: 'narration', label: 'Narration Box', icon: <Square size={18}/> }
                       ].map(t => (
                         <button key={t.id} onClick={() => addTextAsset(t.id as any)} className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all gap-3 group">
                            <span className="text-gray-500 group-hover:text-indigo-400 transition-colors">{t.icon}</span>
                            <span className="text-[8px] font-black uppercase text-gray-400">{t.label}</span>
                         </button>
                       ))}
                    </div>
                    {!selectedPanelId && <div className="text-[9px] text-center text-yellow-500/60 font-black uppercase bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/20 mt-4">Select a panel to add text</div>}
                 </div>
              )}

              {inspectorTab === 'storyboard' && (
                 <div className="space-y-4 pt-4">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest px-2 flex items-center justify-between">
                       Page Manager
                       <button onClick={() => {
                          const newPg = { id: `pg${Date.now()}`, name: `Page ${project.pages.length+1}`, width: 1200, height: 1800, category: 'Comic', backgroundColor: '#ffffff', panels: [] };
                          setProject(prev => ({ ...prev, pages: [...prev.pages, newPg], currentPageIndex: prev.pages.length }));
                       }} className="text-indigo-400 hover:text-indigo-300"><FilePlus size={16}/></button>
                    </h3>
                    <div className="space-y-2">
                       {project.pages.map((p, i) => (
                         <div key={p.id} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 group ${project.currentPageIndex === i ? 'bg-indigo-600 text-white border-indigo-400 shadow-xl' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`} onClick={() => setProject(prev => ({...prev, currentPageIndex: i}))}>
                            <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center font-black text-xs">{i+1}</div>
                            <span className="text-[11px] font-black uppercase tracking-widest flex-1">{p.name}</span>
                            {project.pages.length > 1 && <button onClick={(e) => {
                               e.stopPropagation();
                               setProject(prev => {
                                  const pages = prev.pages.filter(pg => pg.id !== p.id);
                                  return { ...prev, pages, currentPageIndex: Math.min(prev.currentPageIndex, pages.length - 1) };
                               });
                            }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><Trash2 size={14}/></button>}
                         </div>
                       ))}
                    </div>
                 </div>
              )}
           </div>

           {/* PROPERTIES INSPECTOR */}
           <div className="h-80 bg-[#0d0d0d] border-t border-white/5 p-5">
              {selectedLayer ? (
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 border-b border-indigo-500/20 pb-2 flex items-center gap-2"><Layers size={14}/> Layer Properties</h3>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => changeLayerZ(selectedPanelId!, selectedLayer.id, 'up')} className="bg-indigo-600 text-white p-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all"><ArrowUp size={14}/> Top</button>
                       <button onClick={() => changeLayerZ(selectedPanelId!, selectedLayer.id, 'down')} className="bg-white/5 text-gray-400 p-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><ArrowDown size={14}/> Base</button>
                    </div>
                    <PropertySlider label="Scale" value={selectedLayer.scale} min={0.1} max={5} step={0.01} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { scale: +v })} />
                    <RotationKnob label="Rotation" value={selectedLayer.rotation} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { rotation: +v })} />
                 </div>
              ) : selectedPanel ? (
                 <div className="space-y-5 overflow-y-auto custom-scrollbar h-full">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 border-b border-indigo-500/20 pb-2 flex items-center gap-2"><Box size={14}/> Panel Settings</h3>
                    
                    {/* Panel Style Selector */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Frame Style</label>
                       <div className="grid grid-cols-3 gap-2">
                          {(['standard', 'action', 'borderless'] as const).map(style => (
                             <button 
                                key={style}
                                onClick={() => updatePanel(selectedPanelId!, { panelStyle: style })}
                                className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${selectedPanel.panelStyle === style ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}
                             >
                                {style}
                             </button>
                          ))}
                       </div>
                    </div>

                    <PropertySlider label="Width" value={selectedPanel.width} min={50} max={currentPage.width} onChange={v => updatePanel(selectedPanelId!, { width: +v })} />
                    <PropertySlider label="Height" value={selectedPanel.height} min={50} max={currentPage.height} onChange={v => updatePanel(selectedPanelId!, { height: +v })} />
                    
                    {/* Background Selection */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Panel Backdrop</label>
                       <div className="grid grid-cols-4 gap-2">
                          {COLORS.slice(0, 4).concat(['#ffffff', '#000000', '#f3f4f6', '#e5e7eb']).map((c, idx) => (
                             <button 
                                key={idx} 
                                onClick={() => updatePanel(selectedPanelId!, { backgroundColor: c })}
                                className={`h-6 rounded-md border border-white/10 ${selectedPanel.backgroundColor === c ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                             />
                          ))}
                       </div>
                       <div className="grid grid-cols-4 gap-2 mt-2">
                          {GRADIENT_PRESETS.filter(g => g !== 'none').map((g, i) => (
                             <button 
                                key={i} 
                                onClick={() => updatePanel(selectedPanelId!, { backgroundColor: g })}
                                className={`h-6 rounded-md border border-white/10 transition-transform ${selectedPanel.backgroundColor === g ? 'ring-2 ring-indigo-500 scale-110' : 'hover:scale-105'}`}
                                style={{ background: g }}
                             />
                          ))}
                       </div>
                    </div>

                    <div className="flex gap-2 pt-2 pb-10">
                       <button onClick={() => removePanel(selectedPanelId!)} className="flex-1 bg-red-500/10 text-red-500 py-3 rounded-xl text-[9px] font-black uppercase border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">Remove Frame</button>
                    </div>
                 </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-30 text-[10px] uppercase font-black tracking-[0.2em]"><Ghost size={48} className="mb-4" /> Idle Selection</div>
              )}
           </div>
        </div>
      </div>

      {/* PANEL TEMPLATES WINDOW */}
      {showTemplatesWindow && (
        <FloatingWindow title="PANEL LAYOUT TEMPLATES" onClose={() => setShowTemplatesWindow(false)} width="w-[450px]">
           <div className="grid grid-cols-1 gap-3">
              {PANEL_TEMPLATES.map(t => (
                <button key={t.name} onClick={() => applyPanelTemplate(t)} className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all text-left group">
                   <div className="p-3 bg-black/40 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                      {t.icon}
                   </div>
                   <div className="flex-1">
                      <div className="text-[11px] font-black uppercase text-white tracking-widest">{t.name}</div>
                      <div className="text-[9px] font-bold text-gray-500 uppercase mt-1">Pre-arranged frame structure</div>
                   </div>
                   <Plus size={16} className="text-gray-700 group-hover:text-indigo-400" />
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}

      {/* AI FORGE WINDOW (FIXED DAISYCHAIN) */}
      {showAIWindow && (
        <FloatingWindow title="AI PRODUCTION FORGE v3.0" onClose={() => setShowAIWindow(false)} width="w-[980px]" height="h-[780px]">
           <div className="flex flex-col h-full gap-6">
             <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                <button onClick={() => setForgeTab('single')} className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${forgeTab === 'single' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}><Zap size={14}/> Asset Forge</button>
                <button onClick={() => setForgeTab('script')} className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${forgeTab === 'script' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}><List size={14}/> Script Daisychain</button>
             </div>

             <div className="grid grid-cols-12 gap-8 flex-1 overflow-hidden">
                <div className="col-span-3 space-y-6 overflow-y-auto pr-3 custom-scrollbar border-r border-white/5">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-2"><Palette size={14}/> Style Lab</label>
                      <div className="grid grid-cols-1 gap-2">
                         {Object.keys(aiService.STYLE_PRESETS).map(s => (
                           <button key={s} onClick={() => setAiSettings({...aiSettings, stylePreset: s})} className={`px-4 py-3.5 rounded-xl border text-[9px] font-black uppercase transition-all text-left flex items-center justify-between ${aiSettings.stylePreset === s ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black border-white/5 text-gray-600 hover:border-white/20'}`}>
                             {s}
                             {aiSettings.stylePreset === s && <Sparkles size={12}/>}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-3 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 cursor-pointer" onClick={() => setAutoInject(!autoInject)}>
                         <span className="text-[10px] font-black uppercase text-indigo-300">Direct Inject</span>
                         <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${autoInject ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black border-white/10'}`}>{autoInject && <Check size={14} />}</div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 cursor-pointer" onClick={() => setAiSettings({...aiSettings, removeBackground: !aiSettings.removeBackground})}>
                         <span className="text-[10px] font-black uppercase text-indigo-300">Alpha Masking</span>
                         <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${aiSettings.removeBackground ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black border-white/10'}`}>{aiSettings.removeBackground && <Check size={14} />}</div>
                      </div>
                   </div>
                </div>

                <div className="col-span-9 flex flex-col gap-6 overflow-hidden">
                   {forgeTab === 'single' ? (
                     <div className="flex flex-col gap-4 flex-1">
                        <div className="space-y-2">
                           <label className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Target Frame</label>
                           <select className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[10px] uppercase font-bold text-white outline-none focus:border-indigo-500/50" value={targetPanelId || ''} onChange={e => setTargetPanelId(e.target.value)}>
                              <option value="">-- Choose Target Frame --</option>
                              {currentPage.panels.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                           </select>
                        </div>
                        <textarea className="flex-1 w-full bg-black border border-white/10 p-6 rounded-[2rem] outline-none text-white font-bold text-base shadow-inner resize-none focus:border-indigo-500/50 transition-colors" placeholder="Manifest your next panel element..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                     </div>
                   ) : (
                     <div className="flex-1 overflow-y-auto space-y-6 pr-3 custom-scrollbar">
                        <div className="bg-indigo-600/10 p-5 rounded-3xl border border-indigo-500/20 text-[10px] text-indigo-400 font-bold uppercase flex items-center gap-3"><AlertCircle size={18}/> Daisychain Mode: All prompts will execute sequentially.</div>
                        {currentPage.panels.map(p => (
                          <div key={p.id} className={`bg-white/5 p-6 rounded-[2.5rem] border transition-all ${processingPanelId === p.id ? 'border-yellow-400 ring-4 ring-yellow-400/20 bg-yellow-400/5 shadow-2xl scale-[1.01]' : 'border-white/5'}`}>
                             <div className="flex items-center justify-between mb-4">
                                <span className="text-[11px] font-black uppercase text-gray-400 flex items-center gap-2"><Box size={14}/> {p.title} Script</span>
                                <button onClick={() => handleAddPromptToScript(p.id)} className="text-[9px] font-black uppercase text-indigo-400 flex items-center gap-2 hover:bg-indigo-400/10 px-4 py-2 rounded-full transition-all border border-indigo-400/30"><PlusCircle size={14}/> Add Asset Slot</button>
                             </div>
                             <div className="space-y-3">
                                {(panelScripts[p.id] || ['']).map((pr, idx) => (
                                  <div key={idx} className="relative group">
                                     <textarea 
                                       className="w-full bg-black border border-white/5 p-5 rounded-2xl text-white text-sm outline-none focus:border-indigo-500/30 transition-all shadow-inner resize-none" 
                                       placeholder={`Asset #${idx + 1} for ${p.title}...`} 
                                       rows={2}
                                       value={pr} 
                                       onChange={e => handleUpdateScriptPrompt(p.id, idx, e.target.value)}
                                     />
                                     {idx > 0 && (
                                       <button onClick={() => {
                                         const next = [...(panelScripts[p.id] || [])];
                                         next.splice(idx, 1);
                                         setPanelScripts({...panelScripts, [p.id]: next});
                                       }} className="absolute top-3 right-3 text-gray-700 hover:text-red-400 p-1"><X size={14}/></button>
                                     )}
                                  </div>
                                ))}
                             </div>
                          </div>
                        ))}
                     </div>
                   )}

                   <div className="pt-4 border-t border-white/5 flex gap-4">
                      {aiPreview && forgeTab === 'single' && !autoInject && (
                         <div className="flex-1 bg-black/60 rounded-3xl border border-white/10 p-4 flex items-center gap-6 animate-in slide-in-from-left">
                            <img src={aiPreview} className="rounded-xl h-24 w-24 object-cover shadow-2xl border border-white/10" />
                            <div className="flex-1 space-y-2">
                               <div className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-2"><ImageIcon size={14}/> Result Materialized</div>
                               <button onClick={() => { if (targetPanelId) { injectLayerIntoPanel(targetPanelId, aiPreview!); setAiPreview(null); setStatusMessage("Injected."); }}} className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Commit to Frame</button>
                            </div>
                         </div>
                      )}
                      
                      <button onClick={handleAIProduction} disabled={isGenerating || (forgeTab === 'single' && !targetPanelId)} className={`min-w-[320px] py-7 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.4em] shadow-2xl transition-all text-white flex items-center justify-center gap-4 active:scale-95 ${isGenerating ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] shadow-indigo-600/40'}`}>
                         {isGenerating ? <RefreshCw size={24} className="animate-spin"/> : <Play size={24} fill="currentColor"/>} 
                         {forgeTab === 'single' ? 'Manifest vision' : 'Execute script daisychain'}
                      </button>
                   </div>
                </div>
             </div>
           </div>
        </FloatingWindow>
      )}

      {/* STATUS FOOTER */}
      <div className="absolute bottom-6 left-20 bg-black/90 backdrop-blur-2xl px-8 py-3 rounded-full border border-white/10 text-[10px] font-black uppercase text-gray-300 z-[1000] tracking-[0.2em] flex items-center gap-6 shadow-2xl pointer-events-none">
         <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isGenerating ? 'bg-yellow-400 animate-pulse scale-150' : 'bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]'}`} />
         {statusMessage}
         {isGenerating && <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden ml-2"><div className="h-full bg-indigo-500 animate-[loading_2s_infinite]" /></div>}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}
          actions={contextMenu.layerId ? [
            { label: 'Push Forward', icon: <ArrowUp size={14}/>, onClick: () => changeLayerZ(contextMenu.panelId, contextMenu.layerId!, 'up') },
            { label: 'Push Backward', icon: <ArrowDown size={14}/>, onClick: () => changeLayerZ(contextMenu.panelId, contextMenu.layerId!, 'down') },
            { label: 'Delete Element', icon: <Trash2 size={14}/>, onClick: () => removeLayer(contextMenu.panelId, contextMenu.layerId!), danger: true }
          ] : [
            { label: 'Forge Element', icon: <Zap size={14}/>, onClick: () => { setTargetPanelId(contextMenu.panelId); setForgeTab('single'); setShowAIWindow(true); } },
            { label: 'Reset Frame', icon: <RotateCcw size={14}/>, onClick: () => updatePanel(contextMenu.panelId, { layers: [] }) },
            { label: 'Remove Frame', icon: <Trash2 size={14}/>, onClick: () => removePanel(contextMenu.panelId), danger: true }
          ]}
        />
      )}
    </div>
  );
};

export default App;
