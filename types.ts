
export enum LayerType {
  BACKGROUND = 'background',
  CHARACTER = 'character',
  ASSET = 'asset',
  TEXT_BUBBLE = 'text_bubble',
  FREE_TEXT = 'free_text',
  NARRATION = 'narration'
}

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  content: string; 
  originalContent?: string;
  hasBackgroundRemoved?: boolean;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  skewX?: number;
  skewY?: number;
  opacity: number;
  zIndex: number;
  flipX?: boolean;
  flipY?: boolean;
  filter?: string;
  bubbleType?: 'speech' | 'thought' | 'shout' | 'whisper';
  bubbleColor?: string;
  bubbleBorderColor?: string;
  font?: string;
  fontSize?: number;
  color?: string;
  tailX?: number;
  tailY?: number;
}

export interface Panel {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  borderThickness: number;
  borderColor: string;
  borderOpacity: number;
  shadowIntensity: number;
  backgroundColor: string;
  layers: Layer[];
}

export interface ComicProject {
  id: string;
  title: string;
  author: string;
  panels: Panel[];
  width: number;
  height: number;
  zoom: number;
  lastModified: number;
}

export type AIBackend = 'gemini' | 'comfyui' | 'automatic1111';
export type BGRemovalEngine = 'gemini' | 'rembg';

export interface SelectedLora {
  name: string;
  weight: number;
}

export interface AISettings {
  backend: AIBackend;
  endpoint: string; 
  apiKey: string;
  model: string; 
  negativePrompt: string;
  stylePreset: string;
  steps: number;
  cfgScale: number;
  sampler: string;
  removeBackground: boolean;
  bgRemovalEngine: BGRemovalEngine;
  loras: SelectedLora[];
  checkpointFolderPath: string;
  loraFolderPath: string;
  comfyWorkflow?: any;
}
