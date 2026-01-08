// Core types for video localization workflow

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps?: number;
  fileSize: number;
  mimeType: string;
}

export interface VideoFile {
  name: string;
  file: File;
  url: string;
  metadata: VideoMetadata;
}

export interface VideoAnalysis {
  scenes: Scene[];
  transcript: TranscriptSegment[];
  visualContext: VisualContext;
  audioFeatures: AudioFeatures;
}

export interface Scene {
  startTime: number;
  endTime: number;
  description: string;
  objects: string[];
  actions: string[];
  setting: string;
}

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface VisualContext {
  dominantColors: string[];
  setting: string;
  mood: string;
  keyObjects: string[];
}

export interface AudioFeatures {
  language: string;
  numSpeakers: number;
  backgroundMusic: boolean;
  noiseLevel: 'low' | 'medium' | 'high';
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  preserveTiming?: boolean;
  maxLength?: number;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  alternativeTranslations?: string[];
  timingMatch: boolean;
}

export interface VoiceGenerationRequest {
  text: string;
  voiceId: string;
  language: string;
  settings?: VoiceSettings;
}

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface VoiceGenerationResult {
  audioBlob: Blob;
  duration: number;
  voiceId: string;
}

export interface HeyGenVideoResult {
  videoId: string;
  videoBlob: Blob;
  videoUrl: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  duration?: number;
}

export interface QualityAssessment {
  accuracy: number;
  fluency: number;
  culturalAppropriateness: number;
  timingSuitability: number;
  lipSyncScore: number;
  overallScore: number;
  issues: QualityIssue[];
  suggestions: string[];
  approved: boolean;
}

export interface QualityIssue {
  type: 'timing' | 'accuracy' | 'cultural' | 'technical';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp?: number;
  suggestion?: string;
}

export interface Market {
  code: string;
  name: string;
  language: string;
  flag: string;
  voiceId: string;
  culturalNotes?: string[];
}

export interface ProcessingStatus {
  step: ProcessingStep;
  progress: number;
  message: string;
  error?: string;
}

export type ProcessingStep =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'extracting-audio'
  | 'transcribing'
  | 'translating'
  | 'generating-voice'
  | 'generating-video'
  | 'verifying'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface LocalizationJob {
  id: string;
  videoFile: VideoFile;
  targetLanguage: string;
  status: ProcessingStatus;
  analysis?: VideoAnalysis;
  translation?: TranslationResult;
  voice?: VoiceGenerationResult;
  video?: HeyGenVideoResult;
  quality?: QualityAssessment;
  createdAt: Date;
  completedAt?: Date;
}
