
export interface Story {
  id: string;
  title: string;
  content: string;
  theme: string;
  audioGuidance: string;
  posterPrompt: string;
  imageUrl?: string;      // Pre-generated image
  audioBase64?: string;   // Pre-generated audio
}

export type ImageSize = '1K' | '2K' | '4K';

export interface Character {
  name: string;
  description: string;
}
