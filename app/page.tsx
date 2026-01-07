'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Globe,
  Check,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  FileVideo,
  X,
  ChevronRight,
  Mic,
  Languages,
  Volume2,
  CheckCircle2,
  Play,
} from 'lucide-react';

// Types
interface VideoFile {
  name: string;
  duration: string;
  resolution: string;
  size: string;
  file: File;
  url: string;
}

interface Transcript {
  language: string;
  segments: Array<{
    tc: string;
    text: string;
    start: number;
    end: number;
  }>;
  fullText: string;
}

interface Translation {
  text: string;
  targetLanguage: string;
}

interface VerificationResult {
  accuracy: number;
  fluency: number;
  culturalAppropriateness: number;
  timingSuitability: number;
  overallScore: number;
  issues: string[];
  suggestions: string[];
  approved: boolean;
}

interface ProcessedVideo {
  url: string;
  blob: Blob;
}

const MARKETS = [
  { code: 'DE', name: 'German', flag: '🇩🇪', voiceId: 'pNInz6obpgDQGcFmaJgB' },
  { code: 'FR', name: 'French', flag: '🇫🇷', voiceId: '21m00Tcm4TlvDq8ikWAM' },
  { code: 'ES', name: 'Spanish', flag: '🇪🇸', voiceId: 'ThT5KcBeYPX3keUQqHPh' },
  { code: 'IT', name: 'Italian', flag: '🇮🇹', voiceId: 'AZnzlk1XvdvUeBnXmlld' },
  { code: 'NL', name: 'Dutch', flag: '🇳🇱', voiceId: 'flq6f7yk4E4fJM5XTYuZ' },
  { code: 'PL', name: 'Polish', flag: '🇵🇱', voiceId: 'gmWnWbJtQOXAc6KlrF4d' },
  { code: 'PT', name: 'Portuguese', flag: '🇵🇹', voiceId: 'MF3mGyEYCl7XYWbV9V6O' },
  { code: 'JA', name: 'Japanese', flag: '🇯🇵', voiceId: 'jsCqWAovK2LkecY7zXl4' },
];

type ProcessingStep = 'idle' | 'transcribing' | 'translating' | 'generating-audio' | 'verifying' | 'generating-video' | 'complete' | 'error';

export default function VideoLocaliser() {
  const [uploadedFile, setUploadedFile] = useState<VideoFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [processedVideo, setProcessedVideo] = useState<ProcessedVideo | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' bytes';
  };

  const processVideoFile = async (file: File) => {
    const videoUrl = URL.createObjectURL(file);

    const getVideoMetadata = (): Promise<{ duration: number | null; width: number | null; height: number | null }> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const timeoutId = setTimeout(() => {
          resolve({ duration: null, width: null, height: null });
        }, 5000);

        video.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };

        video.onerror = () => {
          clearTimeout(timeoutId);
          resolve({ duration: null, width: null, height: null });
        };

        video.src = videoUrl;
        video.load();
      });
    };

    const metadata = await getVideoMetadata();

    setUploadedFile({
      name: file.name,
      duration: metadata.duration ? formatDuration(metadata.duration) : 'Unknown',
      resolution: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : 'Unknown',
      size: formatFileSize(file.size),
      file: file,
      url: videoUrl,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processVideoFile(file);
      resetProcessing();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processVideoFile(file);
      resetProcessing();
    }
  };

  const clearUpload = () => {
    if (uploadedFile?.url) {
      URL.revokeObjectURL(uploadedFile.url);
    }
    setUploadedFile(null);
    resetProcessing();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetProcessing = () => {
    setTranscript(null);
    setTranslation(null);
    setVerification(null);
    setProcessedVideo(null);
    setAudioBlob(null);
    setProcessingStep('idle');
    setError(null);
  };

  const startProcessing = async () => {
    if (!uploadedFile || !selectedLanguage) return;

    setError(null);

    try {
      // Step 1: Transcribe
      setProcessingStep('transcribing');
      const transcriptResult = await transcribeVideo(uploadedFile.file);
      setTranscript(transcriptResult);

      // Step 2: Translate
      setProcessingStep('translating');
      const translationResult = await translateText(transcriptResult.fullText, selectedLanguage);
      setTranslation(translationResult);

      // Step 3: Generate Audio
      setProcessingStep('generating-audio');
      const market = MARKETS.find(m => m.code === selectedLanguage);
      const audioResult = await generateSpeech(translationResult.text, market?.voiceId || 'default');
      setAudioBlob(audioResult);

      // Step 4: Verify Translation
      setProcessingStep('verifying');
      const verificationResult = await verifyTranslation(
        transcriptResult.fullText,
        translationResult.text,
        'English',
        selectedLanguage
      );
      setVerification(verificationResult);

      // Step 5: Generate Video
      setProcessingStep('generating-video');
      const videoResult = await generateVideo(uploadedFile.file, audioResult);
      setProcessedVideo(videoResult);

      setProcessingStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setProcessingStep('error');
    }
  };

  const transcribeVideo = async (file: File): Promise<Transcript> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const data = await response.json();
    const segments = data.segments?.map((seg: any) => ({
      tc: formatDuration(seg.start),
      text: seg.text.trim(),
      start: seg.start,
      end: seg.end,
    })) || [];

    return {
      language: data.language || 'en',
      segments,
      fullText: data.text,
    };
  };

  const translateText = async (text: string, targetLanguage: string): Promise<Translation> => {
    const market = MARKETS.find(m => m.code === targetLanguage);
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage: market?.name || targetLanguage,
        sourceLanguage: 'English',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Translation failed');
    }

    const data = await response.json();
    return { text: data.translation, targetLanguage };
  };

  const generateSpeech = async (text: string, voiceId: string): Promise<Blob> => {
    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Speech generation failed');
    }

    return await response.blob();
  };

  const verifyTranslation = async (
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<VerificationResult> => {
    const market = MARKETS.find(m => m.code === targetLanguage);
    const response = await fetch('/api/verify-translation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage: market?.name || targetLanguage,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Verification failed');
    }

    return await response.json();
  };

  const generateVideo = async (videoFile: File, audioBlob: Blob): Promise<ProcessedVideo> => {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('audio', audioBlob, 'audio.mp3');

    const response = await fetch('/api/generate-video', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Video generation failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return { url, blob };
  };

  const downloadVideo = () => {
    if (!processedVideo) return;
    const a = document.createElement('a');
    a.href = processedVideo.url;
    a.download = `localized-${selectedLanguage}-${Date.now()}.mp4`;
    a.click();
  };

  const getStepStatus = (step: ProcessingStep) => {
    const steps: ProcessingStep[] = ['transcribing', 'translating', 'generating-audio', 'verifying', 'generating-video'];
    const currentIndex = steps.indexOf(processingStep);
    const stepIndex = steps.indexOf(step);

    if (processingStep === 'complete') return 'complete';
    if (processingStep === 'error') return 'error';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const canProcess = uploadedFile && selectedLanguage && processingStep === 'idle';
  const isProcessing = processingStep !== 'idle' && processingStep !== 'complete' && processingStep !== 'error';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg" />
            <span className="font-semibold text-lg">AI Video Localiser</span>
          </div>
          <span className="text-gray-500 text-sm">Henkel × Accenture Song</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Upload Section */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">1. Upload Video</h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!uploadedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-purple-500 hover:bg-purple-500/5'
                }`}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
                <p className="text-gray-400 mb-2">
                  {isDragging ? 'Drop your video here' : 'Click or drag video here'}
                </p>
                <p className="text-gray-600 text-sm">Supports MP4, MOV, WebM, AVI</p>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start gap-4">
                  <div className="w-32 h-20 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    <video
                      src={uploadedFile.url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-medium truncate">{uploadedFile.name}</h3>
                      <button
                        onClick={clearUpload}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="text-gray-300 ml-2">{uploadedFile.duration}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Resolution:</span>
                        <span className="text-gray-300 ml-2">{uploadedFile.resolution}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Size:</span>
                        <span className="text-gray-300 ml-2">{uploadedFile.size}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Language Selection */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">2. Select Target Language</h2>
            <div className="grid grid-cols-4 gap-3">
              {MARKETS.map((market) => (
                <button
                  key={market.code}
                  onClick={() => setSelectedLanguage(market.code)}
                  disabled={!uploadedFile}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedLanguage === market.code
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{market.flag}</span>
                    {selectedLanguage === market.code && <Check className="w-5 h-5 text-purple-400" />}
                  </div>
                  <p className="text-white font-medium text-sm">{market.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Process Button */}
          <div className="flex justify-center">
            <button
              onClick={startProcessing}
              disabled={!canProcess || isProcessing}
              className="px-8 py-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ChevronRight className="w-5 h-5" />
                  Start Localization
                </>
              )}
            </button>
          </div>

          {/* Processing Pipeline */}
          {(isProcessing || processingStep === 'complete' || processingStep === 'error') && (
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 space-y-4">
              <h2 className="text-xl font-semibold mb-4">Processing Pipeline</h2>

              {/* Steps */}
              <div className="space-y-3">
                {[
                  { step: 'transcribing' as ProcessingStep, icon: Mic, label: 'Transcribing audio', data: transcript },
                  { step: 'translating' as ProcessingStep, icon: Languages, label: 'Translating content', data: translation },
                  { step: 'generating-audio' as ProcessingStep, icon: Volume2, label: 'Generating voice', data: audioBlob },
                  { step: 'verifying' as ProcessingStep, icon: CheckCircle2, label: 'Verifying translation', data: verification },
                  { step: 'generating-video' as ProcessingStep, icon: FileVideo, label: 'Generating final video', data: processedVideo },
                ].map(({ step, icon: Icon, label, data }) => {
                  const status = getStepStatus(step);
                  return (
                    <div key={step} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        status === 'complete' ? 'bg-green-500/20' :
                        status === 'active' ? 'bg-purple-500/20' :
                        status === 'error' ? 'bg-red-500/20' :
                        'bg-gray-700'
                      }`}>
                        {status === 'complete' ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : status === 'active' ? (
                          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                        ) : status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        ) : (
                          <Icon className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          status === 'complete' ? 'text-green-400' :
                          status === 'active' ? 'text-purple-400' :
                          status === 'error' ? 'text-red-400' :
                          'text-gray-500'
                        }`}>
                          {label}
                        </p>
                        {data && status === 'complete' && step === 'transcribing' && (
                          <p className="text-gray-400 text-sm mt-1 truncate">{(data as Transcript).fullText.slice(0, 100)}...</p>
                        )}
                        {data && status === 'complete' && step === 'translating' && (
                          <p className="text-gray-400 text-sm mt-1 truncate">{(data as Translation).text.slice(0, 100)}...</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Verification Results */}
          {verification && processingStep === 'complete' && (
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-4">Translation Quality Report</h2>

              {/* Overall Score */}
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Overall Score</span>
                  <span className={`text-2xl font-bold ${
                    verification.overallScore >= 80 ? 'text-green-400' :
                    verification.overallScore >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {verification.overallScore}%
                  </span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      verification.overallScore >= 80 ? 'bg-green-500' :
                      verification.overallScore >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${verification.overallScore}%` }}
                  />
                </div>
              </div>

              {/* Detailed Scores */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'Accuracy', value: verification.accuracy },
                  { label: 'Fluency', value: verification.fluency },
                  { label: 'Cultural Fit', value: verification.culturalAppropriateness },
                  { label: 'Timing', value: verification.timingSuitability },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400 text-sm">{label}</span>
                      <span className="text-white font-medium">{value}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Issues & Suggestions */}
              {verification.issues.length > 0 && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <h3 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Issues Found
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-300">
                    {verification.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {verification.suggestions.length > 0 && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <h3 className="text-blue-400 font-medium mb-2">Suggestions</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-300">
                    {verification.suggestions.map((suggestion, i) => (
                      <li key={i}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Final Actions */}
          {processedVideo && processingStep === 'complete' && (
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-4">Your Localized Video is Ready!</h2>

              {/* Video Preview */}
              <div className="mb-6 bg-black rounded-lg overflow-hidden">
                <video
                  src={processedVideo.url}
                  controls
                  className="w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={downloadVideo}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Video
                </button>
                <button
                  onClick={resetProcessing}
                  className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Process Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
