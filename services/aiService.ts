import { GoogleGenAI } from "@google/genai";
import { AISettings, SelectedLora } from "../types";

/**
 * AI Service Dispatcher
 * Manages connections between Google Gemini (Cloud) and Local Backends (SD/A1111)
 */

export const fetchA1111Models = async (endpoint: string) => {
  try {
    const response = await fetch(`${endpoint}/sdapi/v1/sd-models`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((m: any) => m.title);
  } catch (error) {
    console.warn("Local SD Checkpoints unreachable:", error);
    return [];
  }
};

export const fetchA1111Loras = async (endpoint: string) => {
  try {
    const response = await fetch(`${endpoint}/sdapi/v1/loras`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((l: any) => l.name);
  } catch (error) {
    console.warn("Local SD LoRAs unreachable:", error);
    return [];
  }
};

export const generateImage = async (prompt: string, settings: AISettings, aspectRatio: string = "1:1") => {
  // Always initialize inside the call context for most up-to-date environment state
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  if (settings.backend === 'gemini') {
    return generateGeminiImage(ai, prompt, aspectRatio);
  } else if (settings.backend === 'automatic1111') {
    return generateA1111Image(prompt, settings);
  }
  throw new Error(`Unsupported backend: ${settings.backend}`);
};

const generateGeminiImage = async (ai: GoogleGenAI, prompt: string, aspectRatio: any) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Professional Comic Book Art Illustration: ${prompt}. High quality, clean lines, vibrant.` }] },
    config: {
      imageConfig: { aspectRatio }
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Gemini Image Generation Failed - No Data Returned.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const generateA1111Image = async (prompt: string, settings: AISettings) => {
  const url = settings.endpoint || "http://127.0.0.1:7860";
  
  // Construct prompt with LoRA weights
  let finalPrompt = `comic book style, illustration, high resolution, ${prompt}`;
  if (settings.loras && settings.loras.length > 0) {
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
    override_settings: {
      sd_model_checkpoint: settings.model
    }
  };

  const response = await fetch(`${url}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Local SD Backend (Automatic1111) is unreachable. Check --api and --cors-allow-origins.");
  }
  
  const data = await response.json();
  return `data:image/png;base64,${data.images[0]}`;
};

export const removeBackground = async (imageBase64: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data, mimeType: 'image/png' } },
        { text: "INSTRUCTION: Cut out the main subject. The background MUST be 100% transparent. Output only the PNG with alpha channel." }
      ]
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Background removal failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const enhancePrompt = async (basePrompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Act as a professional comic book script writer. Transform the following basic idea into a highly descriptive visual prompt for an illustrator: "${basePrompt}". Include details about lighting, camera angle, and comic art style. Output only the prompt text.`,
  });
  return response.text?.trim() || basePrompt;
};