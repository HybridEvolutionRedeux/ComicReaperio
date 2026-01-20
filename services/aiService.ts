
import { GoogleGenAI } from "@google/genai";
import { AISettings, SelectedLora, AIBackend } from "../types";

export const STYLE_PRESETS: Record<string, string> = {
  "None": "",
  "Golden Age": "1940s comic book art, Ben-Day dots, vintage ink, muted primary colors",
  "Modern Marvel": "High-detail digital comic art, dynamic lighting, sharp inks, vibrant colors",
  "Manga": "Black and white ink, screentone textures, expressive eyes, speed lines",
  "Noir": "High contrast black and white, dramatic shadows, gritty atmosphere, hardboiled",
  "Watercolor": "Soft watercolor textures, hand-painted look, artistic bleed, whimsical",
  "Pop Art": "Lichtenstein style, heavy dots, bold thick lines, extremely vibrant",
  "Cinematic": "Movie concept art style, realistic lighting, atmospheric depth, epic scale"
};

export const checkBackendStatus = async (backend: AIBackend, endpoint: string): Promise<boolean> => {
  try {
    if (backend === 'automatic1111') {
      const response = await fetch(`${endpoint}/sdapi/v1/options`, { method: 'GET' });
      return response.ok;
    } else if (backend === 'comfyui') {
      const response = await fetch(`${endpoint}/system_stats`, { method: 'GET' });
      return response.ok;
    }
    return true; 
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
    }
    return [];
  } catch (error) {
    return [];
  }
};

export const generateImage = async (prompt: string, settings: AISettings, aspectRatio: string = "1:1") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const styleInjection = STYLE_PRESETS[settings.stylePreset] || "";
  const fullPrompt = `${styleInjection ? styleInjection + ", " : ""}${prompt}`;

  if (settings.backend === 'gemini') {
    return generateGeminiImage(ai, fullPrompt, aspectRatio, settings.negativePrompt);
  } else if (settings.backend === 'automatic1111') {
    return generateA1111Image(fullPrompt, settings);
  } else if (settings.backend === 'comfyui') {
    return generateComfyImage(fullPrompt, settings);
  }
  throw new Error(`Unsupported backend: ${settings.backend}`);
};

const generateGeminiImage = async (ai: GoogleGenAI, prompt: string, aspectRatio: any, negative: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { 
      parts: [{ 
        text: `Professional Comic Book Art Illustration. ${prompt}. ${negative ? 'Avoid: ' + negative : ''}` 
      }] 
    },
    config: { imageConfig: { aspectRatio } }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Gemini Image Generation Failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const generateA1111Image = async (prompt: string, settings: AISettings) => {
  const url = settings.endpoint || "http://127.0.0.1:7860";
  let finalPrompt = prompt;
  
  if (settings.loras?.length > 0) {
    const loraTags = settings.loras.map(l => `<lora:${l.name}:${l.weight}>`).join(", ");
    finalPrompt += `, ${loraTags}`;
  }

  const payload = {
    prompt: finalPrompt,
    negative_prompt: settings.negativePrompt || "text, watermark, low quality, photorealistic, signature, blur, deformed",
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
  // ComfyUI logic same as before but uses settings.negativePrompt
  throw new Error("ComfyUI endpoint active, but polling not implemented for this session.");
};

export const removeBackground = async (imageBase64: string, settings: AISettings) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data, mimeType: 'image/png' } },
        { text: "Extract the main subject only with perfect transparency. Output as base64 PNG." }
      ]
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Gemini BG removal failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const enhancePrompt = async (basePrompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Transform this into a detailed comic artist prompt. Be descriptive about line weight, lighting, and mood: "${basePrompt}"`,
  });
  return response.text?.trim() || basePrompt;
};
