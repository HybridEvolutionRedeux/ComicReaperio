
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
  opacity: number;
  zIndex: number;
  flipX?: boolean;
  filter?: string;
  bubbleType?: 'speech' | 'thought' | 'shout';
  font?: string;
  fontSize?: number;
  color?: string;
  tailX?: number;
  tailY?: number;
}

export interface Panel {
  id: string;
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
}

export type AIBackend = 'gemini' | 'comfyui' | 'automatic1111';

export interface SelectedLora {
  name: string;
  weight: number;
}

export interface AISettings {
  backend: AIBackend;
  endpoint: string; 
  apiKey: string;
  model: string; // Used as the Checkpoint name in A1111
  steps: number;
  cfgScale: number;
  sampler: string;
  removeBackground: boolean;
  loras: SelectedLora[];
}
