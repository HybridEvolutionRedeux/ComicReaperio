
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, Layers, Wand2, Settings, Download, 
  Grid3X3, Cpu, Zap, RefreshCw, 
  MessageSquare, Box, File, Info, Eye, Folder, 
  FilePlus, X, Paintbrush, Wifi, WifiOff, Layout, ZoomIn, ZoomOut, 
  LayoutDashboard, Database, Trash2, Copy, ArrowUp, ArrowDown, Maximize, RotateCcw,
  Group as GroupIcon, Ungroup as UngroupIcon, ChevronRight, ChevronDown
} from 'lucide-react';
import { ComicProject, Page, Panel, Layer, LayerType, AISettings } from './types';
import { FloatingWindow } from './components/FloatingWindow';
import { FONT_PRESETS, GRADIENT_PRESETS } from './constants';
import { RotationKnob, PropertySlider, PropertyField, ToolbarBtn, ExplorerFolder } from './components/UIElements';
import { PanelItem } from './components/PanelItem';
import { ContextMenu } from './components/ContextMenu';
import * as aiService from './services/aiService';
import html2canvas from 'html2canvas';

const CANVAS_PRESETS = {
  GOLDEN_AGE: { width: 1200, height: 1800, name: 'Golden Age Comic', category: 'Comic', defaultLayout: 'GRID_6' },
  MANGA: { width: 1000, height: 1500, name: 'Tankobon (Manga)', category: 'Comic', defaultLayout: 'GRID_6' },
  GAME_CARD: { width: 750, height: 1050, name: 'Standard Game Card', category: 'Game', defaultLayout: 'GAME_CARD_2' },
  GREETING_CARD: { width: 1500, height: 1050, name: 'Greeting Card (Folded)', category: 'Stationery', defaultLayout: 'GREETING_SINGLE' },
  BOOK_COVER: { width: 1400, height: 2100, name: 'Front/Back Cover', category: 'Book', defaultLayout: 'FULL_SPLASH' },
  BOOK_SPINE: { width: 250, height: 2100, name: 'Spine (Elbow)', category: 'Book', defaultLayout: 'FULL_SPLASH' },
  BOOK_SLEEVE: { width: 500, height: 2100, name: 'Inner Sleeve', category: 'Book', defaultLayout: 'FULL_SPLASH' },
  WIDESCREEN: { width: 1920, height: 1080, name: 'HD Cinematic', category: 'Digital', defaultLayout: 'FULL_SPLASH' },
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
  GAME_CARD_2: {
    name: '2-Panel Game Card',
    panels: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.55 },
      { x: 0.05, y: 0.65, w: 0.9, h: 0.30 }
    ]
  },
  GREETING_SINGLE: {
    name: 'Greeting Card Center',
    panels: [
      { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    ]
  },
  FULL_SPLASH: {
    name: 'Full Page Splash',
    panels: [
      { x: 0.0, y: 0.0, w: 1.0, h: 1.0 }
    ]
  }
};

const STORAGE_KEY = 'comiccraft_studio_v21';

const App: React.FC = () => {
  const [project, setProject] = useState<ComicProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
      return { 
        id: '1', title: 'New Comic', author: 'Artist', 
        pages: [{ id: 'pg1', name: 'Cover', width: 1200, height: 1800, backgroundColor: '#ffffff', panels: [] }],
        currentPageIndex: 0, zoom: 0.4, lastModified: Date.now() 
      };
    } catch {
      return { id: '1', title: 'New Comic', author: 'Artist', pages: [{ id: 'pg1', name: 'Cover', width: 1200, height: 1800, backgroundColor: '#ffffff', panels: [] }], currentPageIndex: 0, zoom: 0.4, lastModified: Date.now() };
    }
  });

  const currentPage = project.pages[project.currentPageIndex] || project.pages[0];

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
  const [multiSelectedLayerIds, setMultiSelectedLayerIds] = useState<string[]>([]);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);
  const [showCanvasWindow, setShowCanvasWindow] = useState(false);
  const [showLayoutWindow, setShowLayoutWindow] = useState(false);
  const [showAIWindow, setShowAIWindow] = useState(false);
  const [showProjectWindow, setShowProjectWindow] = useState(false);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Studio Ready.");
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, panelId: string, layerId: string | null } | null>(null);
  
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const alive = await aiService.checkBackendStatus(aiSettings.backend, aiSettings.endpoint);
      setIsBackendAlive(alive);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000); 
    return () => clearInterval(interval);
  }, [aiSettings.backend, aiSettings.endpoint]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);
  useEffect(() => { localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(aiSettings)); }, [aiSettings]);

  const updateCurrentPage = useCallback((updates: Partial<Page>) => {
    setProject(prev => {
      const pages = [...prev.pages];
      pages[prev.currentPageIndex] = { ...pages[prev.currentPageIndex], ...updates };
      return { ...prev, pages };
    });
  }, []);

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setProject(prev => {
      const pages = [...prev.pages];
      const page = pages[prev.currentPageIndex];
      page.panels = page.panels.map(p => p.id === id ? { ...p, ...updates } : p);
      return { ...prev, pages };
    });
  }, []);

  // Helper to find and update a layer recursively
  const updateLayerInList = (layers: Layer[], lId: string, updates: Partial<Layer>): Layer[] => {
    return layers.map(l => {
      if (l.id === lId) return { ...l, ...updates };
      if (l.children) return { ...l, children: updateLayerInList(l.children, lId, updates) };
      return l;
    });
  };

  const updateLayer = useCallback((pId: string, lId: string, updates: Partial<Layer>) => {
    setProject(prev => {
      const pages = [...prev.pages];
      const page = pages[prev.currentPageIndex];
      page.panels = page.panels.map(p => p.id === pId ? { ...p, layers: updateLayerInList(p.layers, lId, updates) } : p);
      return { ...prev, pages };
    });
  }, []);

  const removeLayerFromList = (layers: Layer[], lId: string): Layer[] => {
    return layers.filter(l => l.id !== lId).map(l => ({
      ...l,
      children: l.children ? removeLayerFromList(l.children, lId) : undefined
    }));
  };

  const removeLayer = useCallback((pId: string, lId: string) => {
    const p = currentPage.panels.find(pan => pan.id === pId);
    if (p) updatePanel(pId, { layers: removeLayerFromList(p.layers, lId) });
    if (selectedLayerId === lId) setSelectedLayerId(null);
  }, [currentPage.panels, selectedLayerId, updatePanel]);

  const removePanel = useCallback((id: string) => {
    updateCurrentPage({ panels: currentPage.panels.filter(p => p.id !== id) });
    if (selectedPanelId === id) setSelectedPanelId(null);
  }, [currentPage.panels, selectedPanelId, updateCurrentPage]);

  const removePage = useCallback((index: number) => {
    setProject(prev => {
      if (prev.pages.length <= 1) return prev;
      const newPages = prev.pages.filter((_, i) => i !== index);
      const newIndex = index < prev.currentPageIndex 
        ? prev.currentPageIndex - 1 
        : Math.min(prev.currentPageIndex, newPages.length - 1);
      return { ...prev, pages: newPages, currentPageIndex: Math.max(0, newIndex) };
    });
    setSelectedPanelId(null);
    setSelectedLayerId(null);
  }, []);

  const groupLayers = useCallback((pId: string, layerIds: string[]) => {
    const panel = currentPage.panels.find(p => p.id === pId);
    if (!panel || layerIds.length < 2) return;

    // Find the layers to group (only from top level for now for simplicity, or we could support recursive search)
    const layersToGroup = panel.layers.filter(l => layerIds.includes(l.id));
    if (layersToGroup.length < 2) return;

    const remainingLayers = panel.layers.filter(l => !layerIds.includes(l.id));

    // Calculate center of group
    const avgX = layersToGroup.reduce((sum, l) => sum + l.x, 0) / layersToGroup.length;
    const avgY = layersToGroup.reduce((sum, l) => sum + l.y, 0) / layersToGroup.length;

    const newGroup: Layer = {
      id: `group_${Date.now()}`,
      type: LayerType.GROUP,
      name: 'Layer Group',
      content: '',
      x: avgX,
      y: avgY,
      scale: 1,
      rotation: 0,
      opacity: 1,
      zIndex: Math.max(...layersToGroup.map(l => l.zIndex)),
      children: layersToGroup.map(l => ({
        ...l,
        x: l.x - avgX, // Make positions relative to group center
        y: l.y - avgY
      })),
      isExpanded: true
    };

    updatePanel(pId, { layers: [...remainingLayers, newGroup] });
    setSelectedLayerId(newGroup.id);
    setMultiSelectedLayerIds([]);
    setStatusMessage("Layers grouped.");
  }, [currentPage.panels, updatePanel]);

  const ungroupLayers = useCallback((pId: string, gId: string) => {
    const panel = currentPage.panels.find(p => p.id === pId);
    if (!panel) return;

    const group = panel.layers.find(l => l.id === gId);
    if (!group || group.type !== LayerType.GROUP || !group.children) return;

    const remainingLayers = panel.layers.filter(l => l.id !== gId);
    
    // Restore relative positions to absolute
    const flattened = group.children.map(l => ({
      ...l,
      x: l.x + group.x,
      y: l.y + group.y,
      rotation: l.rotation + group.rotation,
      scale: l.scale * group.scale,
      opacity: l.opacity * group.opacity
    }));

    updatePanel(pId, { layers: [...remainingLayers, ...flattened] });
    setSelectedLayerId(null);
    setStatusMessage("Layers ungrouped.");
  }, [currentPage.panels, updatePanel]);

  const handleLayerSelect = useCallback((layerId: string, multi: boolean) => {
    if (multi) {
      setMultiSelectedLayerIds(prev => {
        if (prev.includes(layerId)) return prev.filter(id => id !== layerId);
        return [...prev, layerId];
      });
      setSelectedLayerId(null);
    } else {
      setSelectedLayerId(layerId);
      setMultiSelectedLayerIds([]);
    }
  }, []);

  const generatePanelsForLayout = (layoutKey: keyof typeof PANEL_LAYOUTS, width: number, height: number): Panel[] => {
    const layout = PANEL_LAYOUTS[layoutKey];
    return layout.panels.map((p, i) => ({
      id: `p_layout_${Date.now()}_${i}`,
      title: `Panel ${i + 1}`,
      x: p.x * width, y: p.y * height, width: p.w * width, height: p.h * height,
      rotation: 0, zIndex: i + 1, borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4, backgroundColor: '#ffffff', layers: []
    }));
  };

  const addNewPage = (name: string = `Page ${project.pages.length + 1}`, presetKey: keyof typeof CANVAS_PRESETS = 'GOLDEN_AGE') => {
    const preset = CANVAS_PRESETS[presetKey];
    const newPage: Page = {
      id: `pg_${Date.now()}`, name, width: preset.width, height: preset.height, backgroundColor: '#ffffff',
      panels: generatePanelsForLayout(preset.defaultLayout as any, preset.width, preset.height)
    };
    setProject(prev => ({ ...prev, pages: [...prev.pages, newPage], currentPageIndex: prev.pages.length }));
  };

  const handleAIProduction = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const enhanced = await aiService.enhancePrompt(prompt);
      let img: string = await aiService.generateImage(enhanced, aiSettings);
      if (aiSettings.removeBackground && isOnline) img = await aiService.removeBackground(img, aiSettings);
      setAiPreview(img);
      setStatusMessage("Asset generated successfully.");
    } catch (e: any) { 
      setStatusMessage(`Production Error: ${e.message}`); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const changeLayerZ = useCallback((pId: string, lId: string, direction: 'up' | 'down') => {
    setProject(prev => {
      const pages = [...prev.pages];
      const page = pages[prev.currentPageIndex];
      const panel = page.panels.find(p => p.id === pId);
      if (!panel) return prev;
      // Note: Only supports top-level Z-index shift for now
      const layers = [...panel.layers].sort((a, b) => a.zIndex - b.zIndex);
      const idx = layers.findIndex(l => l.id === lId);
      if (direction === 'up' && idx < layers.length - 1) {
        [layers[idx].zIndex, layers[idx+1].zIndex] = [layers[idx+1].zIndex, layers[idx].zIndex];
      } else if (direction === 'down' && idx > 0) {
        [layers[idx].zIndex, layers[idx-1].zIndex] = [layers[idx-1].zIndex, layers[idx].zIndex];
      } else return prev;
      return { ...prev, pages };
    });
  }, []);

  const selectedPanel = currentPage.panels.find(p => p.id === selectedPanelId);
  
  // Recursively find a layer
  const findLayer = (layers: Layer[], id: string): Layer | null => {
    for (const l of layers) {
      if (l.id === id) return l;
      if (l.children) {
        const found = findLayer(l.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  const selectedLayer = selectedPanel ? findLayer(selectedPanel.layers, selectedLayerId || '') : null;

  const handleContextMenu = (e: React.MouseEvent, panelId: string, layerId: string | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, panelId, layerId });
  };

  const renderLayerHierarchy = (layer: Layer, depth = 0) => {
    const isSel = selectedLayerId === layer.id || multiSelectedLayerIds.includes(layer.id);
    return (
      <React.Fragment key={layer.id}>
        <div 
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${isSel ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-gray-400'}`}
          style={{ paddingLeft: `${(depth + 1) * 12}px` }}
          onClick={(e) => {
            e.stopPropagation();
            handleLayerSelect(layer.id, e.shiftKey || e.ctrlKey || e.metaKey);
          }}
        >
          {layer.type === LayerType.GROUP ? (
            <span onClick={(e) => { e.stopPropagation(); updateLayer(selectedPanelId!, layer.id, { isExpanded: !layer.isExpanded }); }}>
              {layer.isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </span>
          ) : null}
          {layer.type === LayerType.GROUP ? <GroupIcon size={14} /> : layer.type === LayerType.TEXT_BUBBLE ? <MessageSquare size={14} /> : <File size={14} />}
          <span className="text-[10px] font-bold uppercase truncate flex-1">{layer.name}</span>
        </div>
        {layer.type === LayerType.GROUP && layer.isExpanded && layer.children?.map(child => renderLayerHierarchy(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-[#050505] select-none overflow-hidden text-gray-400 font-sans flex-col" onPointerDown={() => { setContextMenu(null); }}>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-14 bg-[#111111] border-r border-white/5 flex flex-col items-center py-5 gap-6 z-[100]">
          <div onClick={() => setShowProjectWindow(true)} className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-500 transition-all shadow-xl group relative">
            <Folder size={20} className="text-white" />
          </div>
          <div className="h-px w-6 bg-white/10" />
          <ToolbarBtn icon={<Plus size={18}/>} label="New Panel" onClick={() => {
            const id = `p${Date.now()}`;
            updateCurrentPage({ panels: [...currentPage.panels, { id, title: `Panel ${currentPage.panels.length+1}`, x: 100, y: 100, width: 400, height: 300, rotation: 0, zIndex: currentPage.panels.length+1, borderThickness: 4, borderColor: '#000000', borderOpacity: 1, shadowIntensity: 4, backgroundColor: '#ffffff', layers: [] }] });
            setSelectedPanelId(id);
          }} />
          <ToolbarBtn icon={<MessageSquare size={18}/>} label="Add Bubble" onClick={() => {
            if (!selectedPanelId) return setStatusMessage("Select panel first.");
            const p = currentPage.panels.find(pan => pan.id === selectedPanelId);
            if (!p) return;
            const lid = `l_bub_${Date.now()}`;
            updatePanel(selectedPanelId, { layers: [...p.layers, { id: lid, type: LayerType.TEXT_BUBBLE, name: 'Dialogue', content: 'WRITE...', x: 50, y: 50, scale: 0.3, rotation: 0, opacity: 1, zIndex: p.layers.length + 1, bubbleType: 'speech', bubbleColor: '#ffffff', bubbleBorderColor: '#000000', font: 'Bangers', fontSize: 24, color: '#000000', tailX: 20, tailY: 85 }] });
            setSelectedLayerId(lid);
          }} />
          <ToolbarBtn icon={<GroupIcon size={18}/>} label="Group Selected" onClick={() => selectedPanelId && multiSelectedLayerIds.length > 1 && groupLayers(selectedPanelId, multiSelectedLayerIds)} />
          <ToolbarBtn icon={<Wand2 size={18}/>} label="AI Generator" onClick={() => setShowAIWindow(true)} active={showAIWindow} />
          <ToolbarBtn icon={<Layout size={18}/>} label="Page Setup" onClick={() => setShowCanvasWindow(true)} active={showCanvasWindow} />
          <ToolbarBtn icon={<Grid3X3 size={18}/>} label="Panel Layouts" onClick={() => setShowLayoutWindow(true)} active={showLayoutWindow} />
          <div className="mt-auto flex flex-col gap-4 mb-4">
             <ToolbarBtn icon={<Download size={18}/>} label="Export" onClick={async () => {
                if (!workspaceRef.current) return;
                const canvas = await html2canvas(workspaceRef.current, { scale: 2 });
                const link = document.createElement('a');
                link.download = `comic_page_${currentPage.name.toLowerCase().replace(/\s+/g, '_')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
             }} />
             <ToolbarBtn icon={<Settings size={18}/>} label="Settings" onClick={() => setShowSettingsWindow(true)} active={showSettingsWindow} />
          </div>
        </div>

        {/* Stage */}
        <div className="flex-1 flex flex-col bg-[#0a0a0a] relative">
          <div className="h-14 border-b border-white/5 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar bg-[#0d0d0d]">
             {project.pages.map((pg, idx) => (
                <div key={pg.id} className={`flex items-center gap-3 px-4 py-2 rounded-t-xl cursor-pointer transition-all border-x border-t border-transparent ${project.currentPageIndex === idx ? 'bg-[#111] text-indigo-400 border-white/5 border-b-2 border-b-indigo-500' : 'hover:bg-white/5 text-gray-500'}`} onClick={() => { setProject(p => ({...p, currentPageIndex: idx})); setSelectedPanelId(null); setSelectedLayerId(null); }}>
                   <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{pg.name}</span>
                   {project.pages.length > 1 && <X size={12} className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); removePage(idx); }} />}
                </div>
             ))}
             <button onClick={() => addNewPage()} className="p-2 text-gray-700 hover:text-indigo-400 rounded-lg ml-2" title="New Page"><FilePlus size={18} /></button>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-auto custom-scrollbar" onPointerDown={() => { setSelectedPanelId(null); setSelectedLayerId(null); setMultiSelectedLayerIds([]); }}>
            <div ref={workspaceRef} className="shadow-2xl relative transition-transform duration-200" style={{ width: currentPage.width, height: currentPage.height, background: currentPage.backgroundColor, transform: `scale(${project.zoom})` }}>
              {currentPage.panels.map(p => (
                <PanelItem 
                  key={p.id} 
                  panel={p} 
                  isSelected={selectedPanelId === p.id} 
                  selectedLayerId={selectedLayerId} 
                  multiSelectedLayerIds={multiSelectedLayerIds}
                  onUpdateLayer={updateLayer} 
                  onContextMenu={handleContextMenu} 
                  onLayerSelect={handleLayerSelect}
                  onPointerDown={(e: any) => { e.stopPropagation(); setSelectedPanelId(p.id); setSelectedLayerId(null); setMultiSelectedLayerIds([]); }} 
                />
              ))}
            </div>
            {/* Zoom Controls */}
            <div className="absolute bottom-8 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl z-50">
              <button onClick={() => setProject(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))} className="hover:text-indigo-400"><ZoomOut size={18}/></button>
              <span className="text-[10px] font-black w-12 text-center text-white">{Math.round(project.zoom * 100)}%</span>
              <button onClick={() => setProject(p => ({...p, zoom: Math.min(3, p.zoom + 0.1)}))} className="hover:text-indigo-400"><ZoomIn size={18}/></button>
            </div>
          </div>
        </div>

        {/* Hierarchy Sidebar */}
        <div className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col z-[100] shadow-2xl overflow-hidden">
           <div className="p-4 border-b border-white/5 bg-[#111]">
              <h2 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2">
                <Layers size={14}/> Explorer
              </h2>
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
              {currentPage.panels.map(panel => (
                <div key={panel.id} className="space-y-1">
                  <div 
                    className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all border border-transparent ${selectedPanelId === panel.id ? 'bg-indigo-600/20 border-indigo-500/30 text-white' : 'hover:bg-white/5 text-gray-500'}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedPanelId(panel.id); setSelectedLayerId(null); setMultiSelectedLayerIds([]); }}
                  >
                    <Box size={14} className="text-gray-600" />
                    <span className="text-[10px] font-black uppercase tracking-wide truncate flex-1">{panel.title}</span>
                  </div>
                  <div className="pl-4 space-y-1 border-l border-white/5 ml-2.5">
                    {panel.layers.map(layer => renderLayerHierarchy(layer))}
                  </div>
                </div>
              ))}
           </div>

           <div className="h-2/5 bg-[#0d0d0d] border-t border-white/5 p-4 overflow-y-auto custom-scrollbar">
              {selectedLayer ? (
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 border-b border-indigo-500/20 pb-2">Layer Properties</h3>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => changeLayerZ(selectedPanelId!, selectedLayer.id, 'up')} className="bg-indigo-600 text-white p-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2"><ArrowUp size={14}/> Forward</button>
                       <button onClick={() => changeLayerZ(selectedPanelId!, selectedLayer.id, 'down')} className="bg-white/5 text-gray-400 p-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2"><ArrowDown size={14}/> Backward</button>
                    </div>
                    {selectedLayer.type === LayerType.TEXT_BUBBLE && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <PropertyField label="Text Content" value={selectedLayer.content} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { content: v })} />
                        <PropertySlider label="Font Size" value={selectedLayer.fontSize || 24} min={10} max={120} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { fontSize: +v })} />
                      </div>
                    )}
                    <div className="space-y-6 pt-4 border-t border-white/5">
                      <PropertySlider label="Scale" value={selectedLayer.scale} min={0.1} max={3} step={0.01} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { scale: +v })} />
                      <RotationKnob label="Rotation" value={selectedLayer.rotation} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { rotation: +v })} />
                      <PropertySlider label="Opacity" value={selectedLayer.opacity} min={0} max={1} step={0.05} onChange={v => updateLayer(selectedPanelId!, selectedLayer.id, { opacity: +v })} />
                    </div>
                 </div>
              ) : selectedPanel ? (
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-indigo-400 border-b border-indigo-500/20 pb-2">Panel Properties</h3>
                    <PropertySlider label="Width" value={selectedPanel.width} min={50} max={currentPage.width} onChange={v => updatePanel(selectedPanelId!, { width: +v })} />
                    <PropertySlider label="Height" value={selectedPanel.height} min={50} max={currentPage.height} onChange={v => updatePanel(selectedPanelId!, { height: +v })} />
                    <RotationKnob label="Rotation" value={selectedPanel.rotation} onChange={v => updatePanel(selectedPanelId!, { rotation: +v })} />
                 </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-indigo-400 border-b border-indigo-500/20 pb-2 mb-2">
                    <Paintbrush size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Canvas</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {GRADIENT_PRESETS.map((g, i) => (
                      <button key={i} onClick={() => updateCurrentPage({ backgroundColor: g })} className={`w-full aspect-square rounded-lg border border-white/10 hover:scale-110 transition-transform ${currentPage.backgroundColor === g ? 'ring-2 ring-indigo-500' : ''}`} style={{ background: g === 'none' ? '#fff' : g }} />
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Overlays */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          actions={contextMenu.layerId ? [
            { label: 'Duplicate Layer', icon: <Copy size={14}/>, onClick: () => {
              const p = currentPage.panels.find(pan => pan.id === contextMenu.panelId);
              if (!p) return;
              const l = findLayer(p.layers, contextMenu.layerId!);
              if (!l) return;
              const newL = { ...l, id: `l_${Date.now()}`, x: l.x + 5, y: l.y + 5, zIndex: p.layers.length + 1 };
              updatePanel(contextMenu.panelId, { layers: [...p.layers, newL] });
            }},
            { label: 'Bring to Top', icon: <ArrowUp size={14}/>, onClick: () => {
              const p = currentPage.panels.find(pan => pan.id === contextMenu.panelId);
              if (p) updateLayer(contextMenu.panelId, contextMenu.layerId!, { zIndex: p.layers.length + 5 });
            }},
            { 
              label: 'Group Selected', 
              icon: <GroupIcon size={14}/>, 
              onClick: () => groupLayers(contextMenu.panelId, [contextMenu.layerId!, ...multiSelectedLayerIds]) 
            },
            ...(findLayer(selectedPanel?.layers || [], contextMenu.layerId)?.type === LayerType.GROUP ? [{
              label: 'Ungroup Layers', icon: <UngroupIcon size={14}/>, onClick: () => ungroupLayers(contextMenu.panelId, contextMenu.layerId!)
            }] : []),
            { label: 'Delete Layer', icon: <Trash2 size={14}/>, onClick: () => removeLayer(contextMenu.panelId, contextMenu.layerId!), danger: true }
          ] : [
            { label: 'Clear All Layers', icon: <RotateCcw size={14}/>, onClick: () => updatePanel(contextMenu.panelId, { layers: [] }) },
            { label: 'Maximize Panel', icon: <Maximize size={14}/>, onClick: () => updatePanel(contextMenu.panelId, { x: 0, y: 0, width: currentPage.width, height: currentPage.height }) },
            { label: 'Delete Panel', icon: <Trash2 size={14}/>, onClick: () => removePanel(contextMenu.panelId), danger: true }
          ]}
        />
      )}

      {showAIWindow && (
        <FloatingWindow title="PRODUCTION FORGE" onClose={() => setShowAIWindow(false)} width="w-[700px]">
           <div className="grid grid-cols-12 gap-8 h-[520px] p-2">
              <div className="col-span-5 space-y-6 overflow-y-auto pr-3 custom-scrollbar">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Production Engine</label>
                    <select className="w-full bg-black border border-white/10 p-3 rounded-2xl text-[10px] font-black uppercase text-white outline-none" value={aiSettings.backend} onChange={e => setAiSettings({...aiSettings, backend: e.target.value as any})}>
                       <option value="gemini">Gemini Cloud</option>
                       <option value="automatic1111">Local SD (A1111)</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Negative Prompting</label>
                    <textarea className="w-full bg-black border border-white/10 p-3 rounded-2xl h-24 text-[10px] font-bold text-gray-300 outline-none" placeholder="Elements to exclude..." value={aiSettings.negativePrompt} onChange={e => setAiSettings({...aiSettings, negativePrompt: e.target.value})} />
                 </div>
                 <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <input type="checkbox" checked={aiSettings.removeBackground && isOnline} onChange={e => setAiSettings({...aiSettings, removeBackground: e.target.checked})} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 cursor-pointer">Auto-Transparency</label>
                 </div>
              </div>
              <div className="col-span-7 flex flex-col gap-5">
                 <textarea className="flex-1 w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-bold text-sm" placeholder="Scene Description..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                 <button onClick={handleAIProduction} disabled={isGenerating} className="w-full bg-indigo-600 py-4.5 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl hover:bg-indigo-500 transition-all text-white flex items-center justify-center gap-3">
                    {isGenerating ? <RefreshCw size={18} className="animate-spin"/> : <Zap size={18} fill="currentColor"/>} Generate Production Asset
                 </button>
                 {aiPreview && (
                   <div className="bg-black/40 rounded-3xl border border-white/10 p-4 space-y-4">
                      <img src={aiPreview} className="max-h-48 mx-auto rounded-xl shadow-2xl" />
                      <select className="w-full bg-indigo-600/10 border border-indigo-500/30 p-2 rounded-xl text-[10px] text-indigo-400" onChange={e => setTargetPanelId(e.target.value)}>
                        <option value="">Select Target Frame...</option>
                        {currentPage.panels.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                      <button onClick={() => {
                        if (!targetPanelId) return;
                        const p = currentPage.panels.find(pan => pan.id === targetPanelId);
                        if (p) updatePanel(targetPanelId, { layers: [...p.layers, { id: `l_${Date.now()}`, type: LayerType.CHARACTER, name: 'AI Character', content: aiPreview!, x: 50, y: 50, scale: 0.8, rotation: 0, opacity: 1, zIndex: p.layers.length + 1 }] });
                        setAiPreview(null);
                      }} className="w-full bg-white text-black py-2 rounded-xl font-black uppercase text-[10px]">Commit to Panel</button>
                   </div>
                 )}
              </div>
           </div>
        </FloatingWindow>
      )}

      {showCanvasWindow && (
        <FloatingWindow title="PAGE MANAGEMENT" onClose={() => setShowCanvasWindow(false)} width="w-[500px]">
           <div className="grid grid-cols-2 gap-4">
              {Object.entries(CANVAS_PRESETS).map(([key, val]) => (
                <button key={key} onClick={() => addNewPage(val.name, key as any)} className="bg-white/5 p-4 rounded-xl text-left hover:bg-white/10 border border-white/5 transition-all">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{val.category}</div>
                  <div className="text-white font-bold">{val.name}</div>
                </button>
              ))}
           </div>
        </FloatingWindow>
      )}
    </div>
  );
};

export default App;
