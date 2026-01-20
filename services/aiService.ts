
import { GoogleGenAI } from "@google/genai";
import { AISettings, SelectedLora, AIBackend } from "../types";

/**
 * AI Service Dispatcher
 * Manages connections between Cloud (Gemini) and Local Backends (A1111/ComfyUI)
 */

export const checkBackendStatus = async (backend: AIBackend, endpoint: string): Promise<boolean> => {
  try {
    if (backend === 'automatic1111') {
      const response = await fetch(`${endpoint}/sdapi/v1/options`, { method: 'GET' });
      return response.ok;
    } else if (backend === 'comfyui') {
      const response = await fetch(`${endpoint}/system_stats`, { method: 'GET' });
      return response.ok;
    }
    return true; // Gemini is always considered online if internet exists
  } catch {
    return false;
  }
};

export const fetchLocalModels = async (backend: AIBackend, endpoint: string) => {
  try {
    if (backend === 'automatic1111') {
      const response = await fetch(`${endpoint}/sdapi/v1/sd-models`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((m: any) => m.title);
    } else if (backend === 'comfyui') {
      const response = await fetch(`${endpoint}/models/checkpoints`);
      if (!response.ok) return [];
      return await response.json();
    }
    return [];
  } catch (error) {
    console.warn(`Local models unreachable for ${backend}:`, error);
    return [];
  }
};

export const fetchLocalLoras = async (backend: AIBackend, endpoint: string) => {
  try {
    if (backend === 'automatic1111') {
      const response = await fetch(`${endpoint}/sdapi/v1/loras`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((l: any) => l.name);
    } else if (backend === 'comfyui') {
      const response = await fetch(`${endpoint}/models/loras`);
      if (!response.ok) return [];
      return await response.json();
    }
    return [];
  } catch (error) {
    console.warn(`Local LoRAs unreachable for ${backend}:`, error);
    return [];
  }
};

export const generateImage = async (prompt: string, settings: AISettings, aspectRatio: string = "1:1") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  if (settings.backend === 'gemini') {
    return generateGeminiImage(ai, prompt, aspectRatio);
  } else if (settings.backend === 'automatic1111') {
    return generateA1111Image(prompt, settings);
  } else if (settings.backend === 'comfyui') {
    return generateComfyImage(prompt, settings);
  }
  throw new Error(`Unsupported backend: ${settings.backend}`);
};

const generateGeminiImage = async (ai: GoogleGenAI, prompt: string, aspectRatio: any) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Professional Comic Book Art Illustration: ${prompt}. Clean lines, vibrant coloring.` }] },
    config: { imageConfig: { aspectRatio } }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Gemini Image Generation Failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const generateA1111Image = async (prompt: string, settings: AISettings) => {
  const url = settings.endpoint || "http://127.0.0.1:7860";
  let finalPrompt = `comic book style, illustration, high resolution, ${prompt}`;
  
  if (settings.loras?.length > 0) {
    const loraTags = settings.loras.map(l => `<lora:${l.name}:${l.weight}>`).join(", ");
    finalPrompt += `, ${loraTags}`;
  }

  const payload = {
    prompt: finalPrompt,
    negative_prompt: "text, watermark, low quality, photorealistic, signature, blur, deformed",
    steps: settings.steps || 25,
    cfg_scale: settings.cfgScale || 7,
    width: 768,
    height: 768,
    sampler_name: settings.sampler || "Euler a",
    override_settings: { sd_model_checkpoint: settings.model }
  };

  const response = await fetch(`${url}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Automatic1111 backend unreachable.");
  const data = await response.json();
  return `data:image/png;base64,${data.images[0]}`;
};

const generateComfyImage = async (prompt: string, settings: AISettings) => {
  const url = settings.endpoint || "http://127.0.0.1:8188";
  
  // Basic structure for ComfyUI /prompt injection
  // Note: This requires a specific workflow structure. We assume a standard text-to-image workflow.
  const payload = {
    prompt: {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000),
          "steps": settings.steps,
          "cfg": settings.cfgScale,
          "sampler_name": settings.sampler.toLowerCase().replace(" ", "_"),
          "scheduler": "karras",
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        }
      },
      "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": { "ckpt_name": settings.model }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": { "width": 768, "height": 768, "batch_size": 1 }
      },
      "6": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": `comic book style, ${prompt}`, "clip": ["4", 1] }
      },
      "7": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": "low quality, text, watermark", "clip": ["4", 1] }
      },
      "8": {
        "class_type": "VAEDecode",
        "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
      },
      "9": {
        "class_type": "SaveImage",
        "inputs": { "filename_prefix": "ComicCraft", "images": ["8", 0] }
      }
    }
  };

  const response = await fetch(`${url}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("ComfyUI backend unreachable.");
  const data = await response.json();
  
  // ComfyUI returns a prompt_id. Real-time fetch requires WebSocket. 
  // For this simplified version, we'll inform the user that async polling is needed or return placeholder.
  throw new Error("ComfyUI polling implementation is required for real-time preview. Ensure you have ComfyUI-Manager API extensions.");
};

export const removeBackground = async (imageBase64: string, settings: AISettings) => {
  if (settings.bgRemovalEngine === 'rembg') {
    return removeBackgroundRembg(imageBase64, settings.endpoint);
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data, mimeType: 'image/png' } },
        { text: "Cut out the main subject. Output as transparent PNG." }
      ]
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Gemini BG removal failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const removeBackgroundRembg = async (imageBase64: string, endpoint: string) => {
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  try {
    const response = await fetch(`${endpoint}/rembg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_image: data, model: "u2net" })
    });

    if (!response.ok) throw new Error("Local Rembg extension failed.");
    const json = await response.json();
    return `data:image/png;base64,${json.image}`;
  } catch (e) {
    throw new Error("Local Rembg failed. Ensure extension is installed in A1111.");
  }
};

export const enhancePrompt = async (basePrompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Elaborate this into a visual illustration prompt: "${basePrompt}".`,
  });
  return response.text?.trim() || basePrompt;
};
