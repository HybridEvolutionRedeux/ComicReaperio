
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

export const generateImage = async (prompt: string, settings: AISettings, aspectRatio: string = "1:1"): Promise<string> => {
  const styleInjection = STYLE_PRESETS[settings.stylePreset] || "";
  const fullPrompt = `${styleInjection ? styleInjection + ", " : ""}${prompt}`;

  if (settings.backend === 'gemini') {
    if (!navigator.onLine) throw new Error("Forge requires internet connection for cloud manifest.");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return generateGeminiImage(ai, fullPrompt, aspectRatio, settings.negativePrompt);
  } else if (settings.backend === 'automatic1111') {
    return generateA1111Image(fullPrompt, settings);
  }
  throw new Error(`Unsupported backend: ${settings.backend}`);
};

const generateGeminiImage = async (ai: GoogleGenAI, prompt: string, aspectRatio: any, negative: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { 
      parts: [{ 
        text: `Masterpiece Comic Illustration. ABSOLUTELY NO TEXT, NO CAPTIONS, NO TYPOGRAPHY, NO WATERMARKS. Highly detailed, professional art. Subject: ${prompt}. ${negative ? 'Strictly avoid: ' + negative : ''}` 
      }] 
    },
    config: { imageConfig: { aspectRatio } }
  });

  const candidate = response.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
     throw new Error("No response from AI Forge.");
  }

  const part = candidate.content.parts.find(p => p.inlineData);
  if (!part || !part.inlineData) {
    const textPart = candidate.content.parts.find(p => p.text);
    if (textPart) throw new Error(`Safety Block: ${textPart.text}`);
    throw new Error("Manifestation failed - No image data received.");
  }

  return `data:image/png;base64,${part.inlineData.data}`;
};

const generateA1111Image = async (prompt: string, settings: AISettings): Promise<string> => {
  const cleanEndpoint = settings.endpoint.replace(/\/$/, '') || "http://127.0.0.1:7860";
  const payload = {
    prompt: prompt + (settings.loras?.length ? settings.loras.map(l => `, <lora:${l.name}:${l.weight}>`).join("") : ""),
    negative_prompt: (settings.negativePrompt || "") + ", text, word, letters, alphabet, typography, watermark, signature, blurry, low quality",
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

export const removeBackground = async (imageBase64: string, settings: AISettings): Promise<string> => {
  if (!navigator.onLine) return imageBase64; 
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data, mimeType: 'image/png' } },
        { text: "Extract the primary subject from this image. Remove all background elements completely. Output as a clean PNG with transparency. DO NOT ADD ANY TEXT." }
      ]
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part || !part.inlineData) return imageBase64; 
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const enhancePrompt = async (basePrompt: string): Promise<string> => {
  if (!navigator.onLine) return basePrompt;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Transform this basic comic description into a high-fidelity artist prompt. IMPORTANT: The prompt MUST NOT include any instructions for text, dialogue, or typography. Focus strictly on visual composition, lighting, and character detail. Input: "${basePrompt}"`,
  });
  return response.text?.trim() || basePrompt;
};
