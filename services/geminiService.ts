import { GoogleGenAI } from "@google/genai";

// Always initialize with the current environment variable
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" = "1:1") => {
  try {
    const ai = getAI();
    // Use a strict prompt and system instruction to prevent conversational responses
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `TASK: Generate a single professional comic book illustration. 
PROMPT: ${prompt}
CONSTRAINT: Produce the image directly. Do not respond with conversational text, suggestions, or descriptions.` }]
      },
      config: {
        systemInstruction: "You are a specialized image generation engine. You only output image data. You never engage in conversation, offer suggestions, or explain your process. If you understand the prompt, generate the image immediately. If the prompt is blocked for safety, return a standard refusal message.",
        imageConfig: {
          aspectRatio,
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    let refusalReason = "";

    // Prefer image data over text
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    // If no image data, collect text reasons
    for (const part of parts) {
      if (part.text) {
        refusalReason += part.text;
      }
    }

    if (refusalReason) {
      // If the model is being too 'chatty' or suggesting a 'twist', it's a failure to generate.
      throw new Error(`Model responded with text instead of an image. Reason: ${refusalReason.slice(0, 150)}...`);
    }

    throw new Error("No image data received from the model.");
  } catch (error: any) {
    console.error("Image generation error:", error);
    throw new Error(error.message || "Failed to generate image.");
  }
};

export const removeBackgroundImage = async (imageBase64: string) => {
  try {
    const ai = getAI();
    // Use system instruction to ensure background removal is the priority
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64.split(',')[1],
              mimeType: 'image/png'
            }
          },
          { text: "INSTRUCTION: Detect the main subject and remove everything else. The output image MUST HAVE A TRUE ALPHA CHANNEL (TRANSPARENCY). DO NOT USE A CHECKERBOARD PATTERN. DO NOT USE WHITE OR BLACK BACKGROUNDS. The pixels outside the subject must be fully transparent (0 opacity)." }
        ]
      },
      config: {
        systemInstruction: "You are an expert background removal tool. Your output must be a PNG image where the background is replaced by actual transparency, NOT a checkerboard pattern or solid color. If you cannot produce transparency, use a pure lime green (#00FF00) background that can be keyed out, but transparency is preferred."
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Background removal failed - no image data returned.");
  } catch (error: any) {
    console.error("Background removal error:", error);
    throw new Error(error.message || "Background removal failed.");
  }
};

export const extractSubject = async (imageBase64: string) => {
  try {
    const ai = getAI();
    // A slightly different approach/prompt for subject isolation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64.split(',')[1],
              mimeType: 'image/png'
            }
          },
          { text: "INSTRUCTION: This is a 'Magic Cut' operation. Identify the single most important character or object in this image and cut it out perfectly. The output must be the isolated subject on a TRANSPARENT background. Absolutely NO checkerboard patterns, NO text, and NO borders." }
        ]
      },
      config: {
        systemInstruction: "You isolate subjects for comic books. Your output is only the isolated subject with a transparent background. You never include the original background or any synthetic transparency pattern like a grid."
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Magic extraction failed.");
  } catch (error: any) {
    throw new Error(error.message || "Extraction failed.");
  }
};

export const enhancePrompt = async (basePrompt: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a prompt engineer for comic book artists. 
      Convert the following short idea into a highly detailed, visually descriptive prompt suitable for a 2D comic art style. 
      Focus on lighting, composition, and specific comic styles (e.g., cel-shading, vibrant colors).
      
      Idea: "${basePrompt}"
      
      Response Format: Output ONLY the enhanced prompt string. No conversational filler.`,
    });
    return response.text?.trim() || basePrompt;
  } catch (error) {
    return basePrompt;
  }
};