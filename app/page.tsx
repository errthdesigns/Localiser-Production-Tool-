'use client';

import { useState, useRef } from 'react';

interface VoiceMatch {
  voiceId: string;
  name: string;
  matchScore: number;
  matchReasons: string[];
  previewUrl?: string;
}

interface VoiceRecommendations {
  originalCharacteristics: any;
  recommendedVoices: VoiceMatch[];
  summary: string;
}

type Step = 'upload' | 'review-transcript' | 'voice-selection' | 'processing' | 'complete';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [useDubbingStudio, setUseDubbingStudio] = useState(true); // Default to dubbing studio
  const [useFastMode, setUseFastMode] = useState(true); // Default to fast mode (1-2 min)
  const [dubbingId, setDubbingId] = useState<string>('');
  const [voiceRecommendations, setVoiceRecommendations] = useState<VoiceRecommendations | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<Blob | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<Blob | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [editableTranscript, setEditableTranscript] = useState<string>('');
  const [previewTranslation, setPreviewTranslation] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'it', name: 'Italian' },
  ];

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setError('');
    } else {
      setError('Please select a valid video file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const analyzeVoice = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError('');
    setProgress('Uploading video...');

    try {
      const fileSizeMB = videoFile.size / 1024 / 1024;

      // Warn about very large files
      if (fileSizeMB > 50) {
        setError(`Video file is ${fileSizeMB.toFixed(2)}MB. Maximum file size is 50MB.`);
        setIsLoading(false);
        setProgress('');
        return;
      }

      // Upload to Vercel Blob using client-side upload
      const { upload } = await import('@vercel/blob/client');

      // Generate unique filename to prevent conflicts
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileExt = videoFile.name.split('.').pop();
      const baseName = videoFile.name.replace(`.${fileExt}`, '');
      const uniqueFileName = `${baseName}-${timestamp}-${randomStr}.${fileExt}`;

      setProgress(`Uploading ${fileSizeMB.toFixed(1)}MB video...`);
      const blob = await upload(uniqueFileName, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      console.log('Video uploaded to blob:', blob.url);
      setProgress('Analyzing video and detecting voice characteristics...');

      // Now analyze the uploaded video
      const response = await fetch('/api/recommend-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: blob.url,
          targetLanguage: targetLanguage,
        }),
      });

      if (!response.ok) {
        // Try to get detailed error message from response
        let errorMessage = 'Failed to analyze voice';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setVoiceRecommendations(data);
      setSelectedVoiceId(data.recommendedVoices[0]?.voiceId || '');
      setStep('voice-selection');
    } catch (err) {
      console.error('Voice analysis error:', err);
      setError(err instanceof Error ? err.message : 'Voice analysis failed');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const dubVideoWithStudio = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError('');
    setProgress('Uploading video to ElevenLabs Dubbing Studio...');

    try {
      const fileSizeMB = videoFile.size / 1024 / 1024;

      // Warn about very large files
      if (fileSizeMB > 50) {
        setError(`Video file is ${fileSizeMB.toFixed(2)}MB. Maximum file size is 50MB.`);
        setIsLoading(false);
        setProgress('');
        return;
      }

      // Upload to Vercel Blob using client-side upload
      const { upload } = await import('@vercel/blob/client');

      // Generate unique filename to prevent conflicts
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileExt = videoFile.name.split('.').pop();
      const baseName = videoFile.name.replace(`.${fileExt}`, '');
      const uniqueFileName = `${baseName}-${timestamp}-${randomStr}.${fileExt}`;

      setProgress(`Uploading ${fileSizeMB.toFixed(1)}MB video...`);
      const blob = await upload(uniqueFileName, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      console.log('Video uploaded to blob:', blob.url);
      setProgress('Creating dubbing job...');

      // Create dubbing job
      const response = await fetch('/api/dub-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: blob.url,
          targetLanguage: targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create dubbing job');
      }

      const data = await response.json();
      setDubbingId(data.dubbingId);
      setProgress('Dubbing in progress...');

      // Poll for completion
      await pollDubbingStatus(data.dubbingId);

      setStep('complete');
    } catch (err) {
      console.error('Dubbing error:', err);
      setError(err instanceof Error ? err.message : 'Dubbing failed');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const fastDubVideo = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError('');
    setProgress('Uploading video for transcription...');

    try {
      const fileSizeMB = videoFile.size / 1024 / 1024;

      // Fast dubbing has 25MB limit (OpenAI Whisper limit)
      if (fileSizeMB > 25) {
        setError(`Video file is ${fileSizeMB.toFixed(2)}MB. Maximum file size for fast mode is 25MB.`);
        setIsLoading(false);
        setProgress('');
        return;
      }

      // Upload to Vercel Blob
      const { upload } = await import('@vercel/blob/client');
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileExt = videoFile.name.split('.').pop();
      const baseName = videoFile.name.replace(`.${fileExt}`, '');
      const uniqueFileName = `${baseName}-${timestamp}-${randomStr}.${fileExt}`;

      setProgress(`Uploading ${fileSizeMB.toFixed(1)}MB video...`);
      const blob = await upload(uniqueFileName, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      console.log('Video uploaded to blob:', blob.url);

      // Step 1: Transcribe only
      setProgress('🎤 Transcribing audio with AI...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: blob.url,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();

      console.log('Transcription complete!');
      console.log('Processing time:', data.processingTime, 'seconds');
      console.log('Detected language:', data.language);
      console.log('Transcript:', data.text.substring(0, 100));

      // Set transcript and show review screen
      setOriginalText(data.text);
      setEditableTranscript(data.text);
      setDetectedLanguage(data.language);
      setStep('review-transcript');

    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const loadTranslationPreview = async () => {
    setIsLoadingPreview(true);
    setError('');

    try {
      console.log('Loading translation preview...');

      const response = await fetch('/api/translate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: editableTranscript,
          sourceLanguage: detectedLanguage,
          targetLanguage: targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Translation preview failed');
      }

      const data = await response.json();

      console.log('Translation preview loaded!');
      setPreviewTranslation(data.translatedText);
      setShowPreview(true);

    } catch (err) {
      console.error('Preview error:', err);
      setError(err instanceof Error ? err.message : 'Translation preview failed');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const completeDubbing = async () => {
    setIsLoading(true);
    setError('');
    setProgress('Translating and generating audio...');
    setStep('processing');

    try {
      console.log('Starting translation and dubbing with edited transcript...');

      // Step 2: Translate and generate audio with edited transcript
      setProgress('🌍 Translating to ' + languages.find(l => l.code === targetLanguage)?.name + '...');
      const response = await fetch('/api/translate-and-dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: editableTranscript,
          sourceLanguage: detectedLanguage,
          targetLanguage: targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Translation and dubbing failed');
      }

      const data = await response.json();

      console.log('Dubbing complete!');
      console.log('Processing time:', data.processingTime, 'seconds');
      console.log('Translated:', data.translatedText.substring(0, 100));

      // Convert base64 audio to blob
      const audioBytes = Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

      setGeneratedAudio(audioBlob);
      setTranslatedText(data.translatedText);
      setStep('complete');

    } catch (err) {
      console.error('Dubbing error:', err);
      setError(err instanceof Error ? err.message : 'Dubbing failed');
      setStep('review-transcript');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const pollDubbingStatus = async (jobId: string) => {
    const maxPolls = 360; // 30 minutes max (360 * 5 seconds)
    let polls = 0;
    const startTime = Date.now();

    while (polls < maxPolls) {
      try {
        const response = await fetch(`/api/dub-video/status?dubbingId=${jobId}`);

        if (!response.ok) {
          console.error('Status check failed:', response.status, response.statusText);
          throw new Error(`Failed to check dubbing status: ${response.statusText}`);
        }

        const data = await response.json();

        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const remainingSeconds = elapsedSeconds % 60;

        const timeStr = `${elapsedMinutes}m ${remainingSeconds}s`;
        const statusMessage = data.status === 'dubbing'
          ? `Dubbing in progress - Processing audio and video sync (${timeStr} elapsed)...`
          : data.status === 'dubbed'
          ? `Dubbing complete! Downloading...`
          : `Status: ${data.status} (${timeStr} elapsed)...`;

        console.log(`[Poll ${polls}/${maxPolls}] Status: "${data.status}" | Time: ${timeStr} | Ready: ${data.ready}`);
        console.log('Full status response:', JSON.stringify(data, null, 2));
        setProgress(statusMessage);

        if (data.ready) {
          setProgress('Dubbing complete! Downloading video...');
          console.log('Downloading dubbed video for language:', targetLanguage);

          // Download the dubbed video
          const videoUrl = `/api/dub-video/download?dubbingId=${jobId}&targetLanguage=${targetLanguage}`;
          const videoResponse = await fetch(videoUrl);

          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
          }

          const videoBlob = await videoResponse.blob();
          console.log('Video downloaded successfully, size:', videoBlob.size, 'bytes');
          setGeneratedVideo(videoBlob);
          setProgress('');
          return;
        }

        if (data.status === 'failed') {
          console.error('Dubbing job failed!');
          throw new Error('Dubbing job failed. Please try again.');
        }

        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        polls++;
      } catch (error) {
        console.error('Polling error:', error);
        throw error;
      }
    }

    throw new Error('Dubbing timed out after 30 minutes. ElevenLabs may be experiencing high load. Please try again later.');
  };

  const generateAudio = async (text: string) => {
    setProgress('Generating translated speech with AI voice...');

    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: selectedVoiceId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate audio');
    }

    return await response.blob();
  };

  const generateVideo = async (audioBlob: Blob): Promise<Blob> => {
    if (!videoFile) {
      throw new Error('No video file selected');
    }

    setProgress('Creating lip-synced video (this may take 2-5 minutes)...');

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('audio', audioBlob, 'audio.mp3');

    const response = await fetch('/api/generate-video', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to generate video');
    }

    return await response.blob();
  };

  const processLocalization = async () => {
    if (!videoFile || !selectedVoiceId) return;

    setIsLoading(true);
    setError('');
    setStep('processing');

    try {
      // For demo purposes, we'll use sample text
      // In production, you'd first analyze the video to get the transcript
      const sampleText = "Hello, this is a sample translation for demonstration purposes.";

      // Step 1: Generate audio
      const audioBlob = await generateAudio(sampleText);
      setGeneratedAudio(audioBlob);

      // Step 2: Generate video (DISABLED FOR DEMO - requires VEED_API_KEY)
      // const videoBlob = await generateVideo(audioBlob);
      // setGeneratedVideo(videoBlob);

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('voice-selection');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const reset = () => {
    setStep('upload');
    setVideoFile(null);
    setVoiceRecommendations(null);
    setSelectedVoiceId('');
    setGeneratedAudio(null);
    setGeneratedVideo(null);
    setError('');
    setProgress('');
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          AI Video Localization Tool
        </h1>
        <p className="text-gray-600 mb-8">
          Professional video translation with AI-powered lip-sync and voice matching
        </p>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {['upload', 'voice-selection', 'processing', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : ['upload', 'voice-selection', 'processing', 'complete'].indexOf(step) >
                      ['upload', 'voice-selection', 'processing', 'complete'].indexOf(s)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`w-20 h-1 mx-2 ${
                    ['upload', 'voice-selection', 'processing', 'complete'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Progress Display */}
        {progress && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-3"></div>
            {progress}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">Upload Video</h2>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              {videoFile ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900">{videoFile.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg text-gray-600">Drop video file here or click to browse</p>
                  <p className="text-sm text-gray-400 mt-2">Supports MP4, MOV, AVI (max 4MB for demo)</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 bg-gray-50 p-4 rounded-lg space-y-4">
              {/* Auto Dubbing Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Auto Dubbing
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    {useDubbingStudio
                      ? 'Automatic dubbing with AI (recommended)'
                      : 'Manual voice selection and audio generation'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseDubbingStudio(!useDubbingStudio)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useDubbingStudio ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useDubbingStudio ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Fast Mode Toggle (only shown when Auto Dubbing is ON) */}
              {useDubbingStudio && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      ⚡ Fast Mode
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      {useFastMode
                        ? '1-2 min processing (audio only, no lip-sync)'
                        : '5-30 min processing (full dubbing with lip-sync)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseFastMode(!useFastMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useFastMode ? 'bg-green-600' : 'bg-orange-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useFastMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6">
              {useDubbingStudio && !useFastMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-yellow-800">
                    ⏱️ <strong>Please note:</strong> Full dubbing mode takes 5-15 minutes for short videos,
                    and up to 20-30 minutes for longer videos. Includes audio extraction,
                    translation, voice synthesis, and lip-sync alignment.
                  </p>
                </div>
              )}
              {useDubbingStudio && useFastMode && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-green-800">
                    ⚡ <strong>Fast Mode:</strong> Completes in 1-2 minutes! Uses OpenAI Whisper + GPT-4 + ElevenLabs TTS.
                    Audio-only dubbing (no lip-sync). Max file size: 25MB.
                  </p>
                </div>
              )}
              <button
                onClick={
                  useDubbingStudio
                    ? (useFastMode ? fastDubVideo : dubVideoWithStudio)
                    : analyzeVoice
                }
                disabled={!videoFile || isLoading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {isLoading
                  ? (useDubbingStudio
                      ? (useFastMode ? '⚡ Fast dubbing...' : 'Dubbing in progress...')
                      : 'Analyzing...')
                  : (useDubbingStudio
                      ? (useFastMode ? '⚡ Start Fast Dubbing (1-2 min)' : 'Start Full Dubbing (5-30 min)')
                      : 'Analyze Video & Find Voices')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review Transcript */}
        {step === 'review-transcript' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">📝 Review & Edit Video Script</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Detected Language:</strong> {detectedLanguage.toUpperCase()} → <strong>Target:</strong> {languages.find(l => l.code === targetLanguage)?.name}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                ✏️ Review the video script below. The AI has identified speakers and added inferred on-screen text based on the dialogue.
              </p>
              <p className="text-xs text-blue-700 mt-1 font-medium">
                📝 Add any missing [SUPER: "text"] or [LOCKUP: Brand] elements that appear in your video!
              </p>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 text-xs">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">[TITLE]</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">[SUPER]</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">[LOCKUP]</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">[SCENE]</span>
                </div>
                <button
                  onClick={loadTranslationPreview}
                  disabled={isLoadingPreview || !editableTranscript.trim()}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
                >
                  {isLoadingPreview ? '⏳ Loading...' : showPreview ? '🔄 Refresh Preview' : '👁️ Preview Translation'}
                </button>
              </div>

              {showPreview ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Original ({detectedLanguage.toUpperCase()})
                      <span className="text-gray-500 font-normal ml-2">({editableTranscript.length} chars)</span>
                    </label>
                    <textarea
                      value={editableTranscript}
                      onChange={(e) => {
                        setEditableTranscript(e.target.value);
                        setShowPreview(false); // Hide preview when editing
                      }}
                      rows={16}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm leading-relaxed bg-gray-50"
                      placeholder="Edit script here..."
                      style={{ lineHeight: '1.6' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Translated ({languages.find(l => l.code === targetLanguage)?.name})
                      <span className="text-gray-500 font-normal ml-2">({previewTranslation.length} chars)</span>
                    </label>
                    <div className="w-full px-4 py-3 border border-green-300 rounded-lg font-mono text-sm leading-relaxed bg-green-50 overflow-y-auto" style={{ height: '400px', lineHeight: '1.6' }}>
                      {previewTranslation.split('\n').map((line, i) => (
                        <div key={i}>{line || '\u00A0'}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Production Script
                    <span className="text-gray-500 font-normal ml-2">({editableTranscript.length} characters)</span>
                  </label>
                  <textarea
                    value={editableTranscript}
                    onChange={(e) => setEditableTranscript(e.target.value)}
                    rows={16}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm leading-relaxed bg-gray-50"
                    placeholder="Edit script here..."
                    style={{ lineHeight: '1.6' }}
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📋 Script Format Guide:</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• <strong>[TITLE: "text"]</strong> - Title cards and opening graphics</li>
                <li>• <strong>[SUPER: "text"]</strong> - On-screen text overlays</li>
                <li>• <strong>[LOCKUP: description]</strong> - Brand logos and lockups</li>
                <li>• <strong>[SCENE: description]</strong> - Scene changes and context</li>
                <li>• <strong>SPEAKER NAME:</strong> - Speaker attribution (VOICEOVER, NARRATOR, etc.)</li>
                <li>• <strong>[PAUSE], [MUSIC], [SFX: description]</strong> - Timing and audio cues</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                ← Back
              </button>
              <button
                onClick={completeDubbing}
                disabled={isLoading || !editableTranscript.trim()}
                className="flex-2 bg-green-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {isLoading ? 'Processing...' : '✓ Approve & Continue to Dubbing'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Voice Selection */}
        {step === 'voice-selection' && voiceRecommendations && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">Select Voice</h2>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-700">{voiceRecommendations.summary}</p>
            </div>

            <div className="space-y-4">
              {voiceRecommendations.recommendedVoices.map((voice) => (
                <div
                  key={voice.voiceId}
                  onClick={() => setSelectedVoiceId(voice.voiceId)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                    selectedVoiceId === voice.voiceId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{voice.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Match Score: <span className="font-semibold">{voice.matchScore}%</span>
                      </p>
                      <ul className="mt-2 space-y-1">
                        {voice.matchReasons.map((reason, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-500 mr-2">✓</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {voice.previewUrl && (
                      <audio controls className="ml-4">
                        <source src={voice.previewUrl} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                onClick={processLocalization}
                disabled={!selectedVoiceId || isLoading}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                Generate Localized Audio
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold mb-2">Processing Your Video</h2>
            <p className="text-gray-600">This may take 2-5 minutes. Please wait...</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4 text-green-600">
              ✓ Localization Complete!
            </h2>

            <div className="space-y-4">
              {/* Show transcription and translation for fast mode */}
              {(originalText || translatedText) && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-3">Transcription & Translation</h3>
                  <div className="space-y-3">
                    {originalText && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Original Text:</p>
                        <p className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">
                          {originalText}
                        </p>
                      </div>
                    )}
                    {translatedText && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Translated Text:</p>
                        <p className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-200">
                          {translatedText}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Video Preview with Dubbed Audio */}
              {videoFile && generatedAudio && (
                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <h3 className="font-semibold mb-2 text-green-900">🎬 Video with Dubbed Audio</h3>
                  <p className="text-xs text-green-700 mb-3">
                    Original video playing with AI-generated dubbed audio
                  </p>
                  <video controls className="w-full rounded mb-2" muted>
                    <source src={URL.createObjectURL(videoFile)} type="video/mp4" />
                  </video>
                  <audio controls className="w-full">
                    <source src={URL.createObjectURL(generatedAudio)} type="audio/mpeg" />
                  </audio>
                </div>
              )}

              {generatedAudio && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Generated Audio</h3>
                  <audio controls className="w-full mb-2">
                    <source src={URL.createObjectURL(generatedAudio)} type="audio/mpeg" />
                  </audio>
                  <a
                    href={URL.createObjectURL(generatedAudio)}
                    download="localized-audio.mp3"
                    className="inline-block bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
                  >
                    Download Audio
                  </a>
                </div>
              )}

              {generatedVideo ? (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Lip-Synced Video</h3>
                  <video controls className="w-full rounded mb-2">
                    <source src={URL.createObjectURL(generatedVideo)} type="video/mp4" />
                  </video>
                  <a
                    href={URL.createObjectURL(generatedVideo)}
                    download="localized-video.mp4"
                    className="inline-block bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
                  >
                    Download Video
                  </a>
                </div>
              ) : (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-blue-900">📹 Video Lip-Sync (Coming Soon)</h3>
                  <p className="text-sm text-blue-700">
                    AI-powered lip-sync video generation will be available once you add your VEED_API_KEY to the environment variables.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={reset}
              className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Process Another Video
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
