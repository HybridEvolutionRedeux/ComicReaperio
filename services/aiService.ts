
import { GoogleGenAI } from "@google/genai";
import { AISettings, SelectedLora } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const fetchA1111Models = async (endpoint: string) => {
  try {
    const response = await fetch(`${endpoint}/sdapi/v1/sd-models`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((m: any) => m.title);
  } catch {
    return [];
  }
};

export const fetchA1111Loras = async (endpoint: string) => {
  try {
    const response = await fetch(`${endpoint}/sdapi/v1/loras`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((l: any) => l.name);
  } catch {
    return [];
  }
};

export const generateImage = async (prompt: string, settings: AISettings, aspectRatio: string = "1:1") => {
  if (settings.backend === 'gemini') {
    return generateGeminiImage(prompt, aspectRatio);
  } else if (settings.backend === 'automatic1111') {
    return generateA1111Image(prompt, settings);
  } else if (settings.backend === 'comfyui') {
    throw new Error("ComfyUI requires custom workflow mapping. Please use A1111 for standard API calls.");
  }
  throw new Error("Unsupported backend");
};

const generateGeminiImage = async (prompt: string, aspectRatio: any) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Professional Comic Book Art: ${prompt}` }] },
    config: {
      systemInstruction: "You are a professional comic book illustrator.",
      imageConfig: { aspectRatio }
    }
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Gemini returned no image.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const generateA1111Image = async (prompt: string, settings: AISettings) => {
  const url = settings.endpoint || "http://127.0.0.1:7860";
  
  // Inject LoRAs into the prompt
  let finalPrompt = `comic book style, high quality, ${prompt}`;
  if (settings.loras && settings.loras.length > 0) {
    const loraTags = settings.loras.map(l => `<lora:${l.name}:${l.weight}>`).join(" ");
    finalPrompt += `, ${loraTags}`;
  }

  const payload = {
    prompt: finalPrompt,
    negative_prompt: "text, watermark, low quality, photorealistic, signature",
    steps: settings.steps || 20,
    cfg_scale: settings.cfgScale || 7,
    width: 512,
    height: 512,
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
    const errText = await response.text();
    throw new Error(`A1111 Error: ${errText || "Backend Unreachable"}`);
  }
  
  const data = await response.json();
  return `data:image/png;base64,${data.images[0]}`;
};

export const removeBackground = async (imageBase64: string) => {
  const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data, mimeType: 'image/png' } },
        { text: "Remove background. Return isolated subject as transparent PNG." }
      ]
    }
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part) throw new Error("Transparency processing failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const enhancePrompt = async (basePrompt: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Detailed comic artist prompt: "${basePrompt}".`,
  });
  return response.text?.trim() || basePrompt;
};
