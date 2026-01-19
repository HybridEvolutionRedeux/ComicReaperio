
import { GoogleGenAI } from "@google/genai";

// Standard initialization using required named parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" = "1:1") => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ 
          text: `Professional Comic Book Art. High resolution, clear subject, clean outlines. Prompt: ${prompt}` 
        }]
      },
      config: {
        systemInstruction: "You are a professional comic book illustrator. You only output image data. No text.",
        imageConfig: {
          aspectRatio,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned.");
  } catch (error: any) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

export const removeBackgroundImage = async (imageBase64: string) => {
  try {
    const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data, mimeType: 'image/png' } },
          { text: "INSTRUCTION: Cut out the subject and return only the isolated object. The background MUST be perfectly transparent (PNG Alpha channel). Do not use white, black, or checkerboard pixels." }
        ]
      },
      config: {
        systemInstruction: "You are an expert at background removal. You MUST provide actual transparency in the output image file."
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Background removal failed.");
  } catch (error: any) {
    console.error("Gemini Masking Error:", error);
    throw error;
  }
};

export const enhancePrompt = async (basePrompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Transform this into a detailed comic artist prompt: "${basePrompt}". Add visual descriptors. Output string only.`,
    });
    return response.text?.trim() || basePrompt;
  } catch {
    return basePrompt;
  }
};
