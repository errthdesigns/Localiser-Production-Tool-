// Core type definitions for the localization tool

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface VideoAnalysisResult {
  transcript: TranscriptSegment[];
  scenes: string[];
  visualContext: string;
  duration: number;
  language: string;
}

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  targetLanguage: string;
  confidence: number;
}

export interface VoiceGenerationResult {
  audioBlob: Blob;
  duration: number;
  voiceId: string;
}

export interface VoiceCharacteristics {
  gender: 'male' | 'female' | 'neutral';
  ageRange: 'young' | 'middle-aged' | 'mature' | 'elderly';
  tone: string[];
  pace: 'slow' | 'moderate' | 'fast';
  pitch: 'low' | 'medium' | 'high';
  accent: string;
  emotion: string[];
  description: string;
}

export interface VoiceMatch {
  voiceId: string;
  name: string;
  matchScore: number;
  matchReasons: string[];
  previewUrl?: string;
  labels: Record<string, string>;
}

export interface HeyGenVideoResult {
  videoId: string;
  videoBlob: Blob;
  videoUrl: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  duration?: number;
}
