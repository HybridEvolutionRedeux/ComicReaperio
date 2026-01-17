
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
  content: string; // URL for images, string for text
  originalContent?: string; // Stored image with background for restoration
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
  tailX?: number; // Relative to bubble center
  tailY?: number; // Relative to bubble center
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

export type AISource = 'online' | 'offline' | 'local';
export type AIBackend = 'gemini' | 'comfyui' | 'automatic1111';

export interface AISettings {
  source: AISource;
  backend: AIBackend;
  endpoint: string; // e.g. http://127.0.0.1:8188 for ComfyUI
  apiKey: string;
  model: string;
  loras: string[];
  csvSource?: string;
  removeBackground: boolean;
  targetType: 'background' | 'character';
}
