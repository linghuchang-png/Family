
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { Story } from "../types";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const errorStr = JSON.stringify(error).toLowerCase();
        
        // Detect tier limitation (limit: 0) which implies a free tier key trying to access paid-only features
        if (errorStr.includes('limit: 0') || errorStr.includes('limit:0')) {
          console.error("Critical: API Key tier insufficient (limit: 0).");
          throw new Error("PAID_KEY_REQUIRED");
        }

        const status = error?.status || (errorStr.includes('429') ? 429 : errorStr.includes('503') ? 503 : 0);
        
        // Retry on transient errors (rate limits or overloaded models)
        if (status === 429 || status === 503 || errorStr.includes('overloaded') || errorStr.includes('quota') || errorStr.includes('exhausted')) {
          const delay = Math.pow(2, i) * 3000 + Math.random() * 1000;
          console.warn(`API Error (${status}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateStories(): Promise<Story[]> {
    return this.withRetry(async () => {
      // Re-initialize to ensure we use the current API key from process.env
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        // Using gemini-3-flash-preview for basic text task
        model: 'gemini-3-flash-preview',
        contents: "请为4岁宝宝生成10个原创、温馨且幽默的睡前故事。主要角色固定为：小熊嘟嘟（憨萌、爱讲冷笑话）和小兔闹闹（古灵精怪、点子大王）。【重要：请随机地将‘Mumu’、‘Yiyi’、‘爸爸’或‘妈妈’作为配角编入每个故事中】。每个故事约350-450个汉字。输出JSON数组，包含：id, title, theme, content, audioGuidance, posterPrompt。其中posterPrompt必须要求包含文字'To: Mumu & Yiyi - By Daddy'，风格为温馨可爱的水彩绘本感。",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                theme: { type: Type.STRING },
                content: { type: Type.STRING },
                audioGuidance: { type: Type.STRING },
                posterPrompt: { type: Type.STRING },
              },
              required: ["id", "title", "theme", "content", "audioGuidance", "posterPrompt"],
            },
          },
        },
      });

      // Extracting text output from GenerateContentResponse using .text property
      const text = response.text;
      if (!text) throw new Error("Empty AI response");
      return JSON.parse(text);
    });
  }

  async generatePoster(prompt: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Inject the text requirement directly into the prompt to ensure compliance
      const fullPrompt = `${prompt}. The image MUST include the English text "To: Mumu & Yiyi - By Daddy" clearly rendered as part of the illustration's dedication.`;
      
      const response = await ai.models.generateContent({
        // Use gemini-2.5-flash-image for standard image generation tasks
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: fullPrompt }] },
        config: { imageConfig: { aspectRatio: "4:3" } }
      });

      const candidate = response.candidates?.[0];
      if (!candidate) throw new Error("No image generated (No candidate returned)");

      if (candidate.finishReason === 'SAFETY') {
        throw new Error("Image generation blocked by safety filters.");
      }

      if (!candidate.content?.parts) throw new Error("No parts in the generated content");

      let refusalText = "";
      for (const part of candidate.content.parts) {
        // Find the image part, do not assume it is the first part.
        if (part.inlineData) return part.inlineData.data;
        if (part.text) refusalText += part.text;
      }
      
      throw new Error(refusalText || "Missing inlineData in image response");
    });
  }

  async textToSpeech(text: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        // Use gemini-2.5-flash-preview-tts for text-to-speech tasks
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `请用温柔深情、略带磁性的爸爸的声音朗读：\n\n${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          }
        }
      });

      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64) throw new Error("Audio generation failed");
      return base64;
    });
  }

  async transcribeAudio(audioData: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await ai.models.generateContent({
      // Use the native audio model for handling audio input prompts
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      contents: {
        parts: [
          // Use 'audio/pcm' for raw audio streams as per guidelines
          { inlineData: { mimeType: 'audio/pcm;rate=16000', data: audioData } },
          { text: "Transcription in Simplified Chinese." }
        ]
      }
    });
    // Use .text property to get the generated transcription
    return response.text || "";
  }
}

// Custom decoding function for raw PCM audio data
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  // Use slice to ensure we aren't passing a TypedArray with an offset
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(arrayBuffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Manual implementation of base64 encoding/decoding as required
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
