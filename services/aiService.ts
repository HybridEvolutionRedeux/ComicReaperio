
import { GoogleGenAI } from "@google/genai";
import { AISettings, SelectedLora, AIBackend } from "../types";

export const STYLE_PRESETS: Record<string, string> = {
  "None": "",
  "Golden Age": "1940s comic book art, Ben-Day dots, vintage ink, muted primary colors, golden age style",
  "Modern Marvel": "High-detail digital comic art, dynamic lighting, sharp inks, vibrant colors, blockbuster style",
  "Manga": "Authentic manga ink, screentone textures, expressive eyes, speed lines, black and white aesthetic",
  "Noir": "Chiaroscuro lighting, high contrast black and white, dramatic shadows, gritty 1950s detective comic",
  "Watercolor": "Soft watercolor textures, hand-painted comic look, artistic bleed, whimsical children's book ink",
  "Pop Art": "Roy Lichtenstein style, heavy Ben-Day dots, bold thick black lines, primary colors",
  "Cinematic": "Movie concept art illustration, realistic cinematic lighting, atmospheric depth, epic scale",
  "Cyberpunk": "Neon colors, futuristic technology, rainy streets, glowing highlights, high-tech low-life aesthetic"
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

export const checkBackendStatus = async (backend: AIBackend, endpoint: string): Promise<boolean> => {
  try {
    const cleanEndpoint = endpoint.replace(/\/$/, '');
    if (backend === 'automatic1111') {
      const response = await fetchWithTimeout(`${cleanEndpoint}/sdapi/v1/options`, { method: 'GET' });
      return response.ok;
    } else if (backend === 'comfyui') {
      const response = await fetchWithTimeout(`${cleanEndpoint}/system_stats`, { method: 'GET' });
      return response.ok;
    }
    return navigator.onLine; 
  } catch {
    return false;
  }
};

export const fetchLocalModels = async (backend: AIBackend, endpoint: string) => {
  try {
    const cleanEndpoint = endpoint.replace(/\/$/, '');
    if (backend === 'automatic1111') {
      const response = await fetchWithTimeout(`${cleanEndpoint}/sdapi/v1/sd-models`, { method: 'GET' });
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((m: any) => m.title);
    }
    return [];
  } catch (error) {
    return [];
  }
};

export const fetchLocalLoras = async (backend: AIBackend, endpoint: string) => {
  try {
    const cleanEndpoint = endpoint.replace(/\/$/, '');
    if (backend === 'automatic1111') {
      const response = await fetchWithTimeout(`${cleanEndpoint}/sdapi/v1/loras`, { method: 'GET' });
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((l: any) => l.name);
    }
    return [];
  } catch (error) {
    return [];
  }
};

/**
 * Generates an image based on the chosen backend.
 * Fix: Explicitly typed return value as Promise<string> to avoid 'unknown' type issues in components.
 */
export const generateImage = async (prompt: string, settings: AISettings, aspectRatio: string = "1:1"): Promise<string> => {
  const styleInjection = STYLE_PRESETS[settings.stylePreset] || "";
  const fullPrompt = `${styleInjection ? styleInjection + ", " : ""}${prompt}`;

  if (settings.backend === 'gemini') {
    if (!navigator.onLine) throw new Error("Cloud generator requires internet connection.");
    // Fix: correct initialization using named parameter as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return generateGeminiImage(ai, fullPrompt, aspectRatio, settings.negativePrompt);
  } else if (settings.backend === 'automatic1111') {
    return generateA1111Image(fullPrompt, settings);
  } else if (settings.backend === 'comfyui') {
    return generateComfyImage(fullPrompt, settings);
  }
  throw new Error(`Unsupported backend: ${settings.backend}`);
};

/**
 * Generates image via Gemini model.
 * Uses gemini-2.5-flash-image for standard image generation.
 */
const generateGeminiImage = async (ai: GoogleGenAI, prompt: string, aspectRatio: any, negative: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { 
      parts: [{ 
        text: `Masterpiece Comic Illustration. Highly detailed. ${prompt}. ${negative ? 'Strictly avoid: ' + negative : ''}` 
      }] 
    },
    config: { imageConfig: { aspectRatio } }
  });

  // Find the image part in response candidates as per guidelines.
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part || !part.inlineData) throw new Error("Gemini Image Generation Failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const generateA1111Image = async (prompt: string, settings: AISettings): Promise<string> => {
  const cleanEndpoint = settings.endpoint.replace(/\/$/, '') || "http://127.0.0.1:7860";
  const payload = {
    prompt: prompt + (settings.loras?.length ? settings.loras.map(l => `, <lora:${l.name}:${l.weight}>`).join("") : ""),
    negative_prompt: settings.negativePrompt || "low quality, text, watermark",
    steps: settings.steps || 25,
    cfg_scale: settings.cfgScale || 7.0,
    width: 1024,
    height: 1024,
    sampler_name: settings.sampler || "Euler a",
    override_settings: { sd_model_checkpoint: settings.model }
  };

  const response = await fetch(`${cleanEndpoint}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Local SD backend (A1111) unreachable.");
  const data = await response.json();
  return `data:image/png;base64,${data.images[0]}`;
};

/**
 * Generates image via ComfyUI.
 * Fix: Explicitly typed Promise as <string> to ensure consistent return types.
 */
const generateComfyImage = async (prompt: string, settings: AISettings): Promise<string> => {
  const cleanEndpoint = settings.endpoint.replace(/\/$/, '') || "http://127.0.0.1:8188";
  
  const workflow = {
    "3": {
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": settings.steps || 20,
        "cfg": settings.cfgScale || 7,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "4": {
      "inputs": { "ckpt_name": settings.model || "v1-5-pruned-emaonly.ckpt" },
      "class_type": "CheckpointLoaderSimple"
    },
    "5": {
      "inputs": { "width": 1024, "height": 1024, "batch_size": 1 },
      "class_type": "EmptyLatentImage"
    },
    "6": {
      "inputs": { "text": prompt, "clip": ["4", 1] },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": { "text": settings.negativePrompt || "text, watermark, low quality", "clip": ["4", 1] },
      "class_type": "CLIPTextEncode"
    },
    "8": {
      "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": { "filename_prefix": "ComicCraft", "images": ["8", 0] },
      "class_type": "SaveImage"
    }
  };

  const response = await fetch(`${cleanEndpoint}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });

  if (!response.ok) throw new Error("ComfyUI backend unreachable.");
  const data = await response.json();
  const promptId = data.prompt_id;

  return new Promise<string>((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const historyRes = await fetch(`${cleanEndpoint}/history/${promptId}`);
        const history = await historyRes.json();
        if (history[promptId]) {
          const image = history[promptId].outputs["9"].images[0];
          const viewUrl = `${cleanEndpoint}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
          const imgRes = await fetch(viewUrl);
          const blob = await imgRes.blob();
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        } else {
          setTimeout(checkStatus, 1500);
        }
      } catch (e) {
        reject(e);
      }
    };
    checkStatus();
  });
};

/**
 * Removes background from an image using Gemini.
 * Fix: initialization and explicit return type.
 */
export const removeBackground = async (imageBase64: string, settings: AISettings): Promise<string> => {
  if (!navigator.onLine) return imageBase64; 
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data, mimeType: 'image/png' } },
        { text: "Extract subject only with perfect transparency. Output base64 PNG." }
      ]
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part || !part.inlineData) throw new Error("Background removal failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

/**
 * Enhances a prompt using Gemini flash.
 */
export const enhancePrompt = async (basePrompt: string): Promise<string> => {
  if (!navigator.onLine) return basePrompt;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Detailed artist prompt for: "${basePrompt}"`,
  });
  return response.text?.trim() || basePrompt;
};
