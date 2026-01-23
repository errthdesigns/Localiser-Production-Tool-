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

type Step = 'upload' | 'edit-english' | 'edit-translation' | 'processing' | 'complete';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>(''); // Store the uploaded video URL
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
  const [disableVoiceCloning, setDisableVoiceCloning] = useState(false);
  const [dropBackgroundAudio, setDropBackgroundAudio] = useState(false);
  const [generatedAudioOnly, setGeneratedAudioOnly] = useState<Blob | null>(null);
  const [sourceTranscript, setSourceTranscript] = useState<string>('');
  const [targetTranscript, setTargetTranscript] = useState<string>('');
  const [currentDubbingId, setCurrentDubbingId] = useState<string>('');
  const [demoMode, setDemoMode] = useState(false); // Skip waiting for demo
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available voices on mount
  const fetchAvailableVoices = async () => {
    try {
      const response = await fetch('/api/elevenlabs/voices');
      if (response.ok) {
        const data = await response.json();
        setAvailableVoices(data.voices || []);
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    }
  };

  const languages = [
    { code: 'en', name: 'English' },
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
      setStep('edit-english'); // Skip voice selection in new workflow
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
      setVideoUrl(blob.url); // Save video URL to state

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

      // Set transcript and show edit screen
      setOriginalText(data.text);
      setEditableTranscript(data.text);
      setDetectedLanguage(data.language);
      setStep('edit-english');

    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const downloadAudioOnly = async () => {
    if (!videoUrl) return;

    setIsLoading(true);
    setError('');
    setProgress('Downloading audio-only translation...');

    try {
      const response = await fetch('/api/translate-and-dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          targetLanguage: targetLanguage,
          sourceLanguage: undefined,
          disableVoiceCloning: disableVoiceCloning,
          dropBackgroundAudio: dropBackgroundAudio,
          audioOnly: true, // Request audio-only
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Audio download failed');
      }

      const data = await response.json();

      if (!data.audioData) {
        throw new Error('API did not return audio data.');
      }

      // Convert base64 audio to blob
      const audioBytes = Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

      setGeneratedAudioOnly(audioBlob);

      // Automatically trigger download
      const downloadUrl = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `dubbed-audio-${targetLanguage}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      console.error('Audio download error:', err);
      setError(err instanceof Error ? err.message : 'Audio download failed');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const directDubbing = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError('');
    setProgress('Uploading video...');
    setStep('processing');

    try {
      const fileSizeMB = videoFile.size / 1024 / 1024;

      if (fileSizeMB > 50) {
        setError(`Video file is ${fileSizeMB.toFixed(2)}MB. Maximum file size is 50MB.`);
        setIsLoading(false);
        setProgress('');
        setStep('upload');
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
      setVideoUrl(blob.url);

      // DEMO MODE: Skip API calls and show mock transcripts immediately
      if (demoMode) {
        console.log('🚀 DEMO MODE: Using mock data for instant preview');
        setProgress('✨ Demo mode: Loading instant preview...');

        // Mock transcripts
        const mockSourceTranscript = `1
00:00:00,000 --> 00:00:03,500
[SPEAKER 1]
Welcome to our product demonstration.

2
00:00:03,500 --> 00:00:07,000
[SPEAKER 1]
Today we'll show you how our software works.

3
00:00:07,000 --> 00:00:10,500
[SPEAKER 2]
This technology will revolutionize your workflow.

4
00:00:10,500 --> 00:00:14,000
[SPEAKER 2]
Let's dive into the key features.`;

        const mockTargetTranscript = targetLanguage === 'es'
          ? `1
00:00:00,000 --> 00:00:03,500
[SPEAKER 1]
Bienvenido a nuestra demostración de producto.

2
00:00:03,500 --> 00:00:07,000
[SPEAKER 1]
Hoy le mostraremos cómo funciona nuestro software.

3
00:00:07,000 --> 00:00:10,500
[SPEAKER 2]
Esta tecnología revolucionará su flujo de trabajo.

4
00:00:10,500 --> 00:00:14,000
[SPEAKER 2]
Profundicemos en las características clave.`
          : targetLanguage === 'fr'
          ? `1
00:00:00,000 --> 00:00:03,500
[SPEAKER 1]
Bienvenue à notre démonstration de produit.

2
00:00:03,500 --> 00:00:07,000
[SPEAKER 1]
Aujourd'hui, nous vous montrerons comment fonctionne notre logiciel.

3
00:00:07,000 --> 00:00:10,500
[SPEAKER 2]
Cette technologie révolutionnera votre flux de travail.

4
00:00:10,500 --> 00:00:14,000
[SPEAKER 2]
Plongeons dans les fonctionnalités clés.`
          : targetLanguage === 'it'
          ? `1
00:00:00,000 --> 00:00:03,500
[SPEAKER 1]
Benvenuti alla nostra dimostrazione del prodotto.

2
00:00:03,500 --> 00:00:07,000
[SPEAKER 1]
Oggi vi mostreremo come funziona il nostro software.

3
00:00:07,000 --> 00:00:10,500
[SPEAKER 2]
Questa tecnologia rivoluzionerà il vostro flusso di lavoro.

4
00:00:10,500 --> 00:00:14,000
[SPEAKER 2]
Approfondiamo le caratteristiche principali.`
          : `1
00:00:00,000 --> 00:00:03,500
[SPEAKER 1]
Welcome to our product demonstration.

2
00:00:03,500 --> 00:00:07,000
[SPEAKER 1]
Today we'll show you how our software works.

3
00:00:07,000 --> 00:00:10,500
[SPEAKER 2]
This technology will revolutionize your workflow.

4
00:00:10,500 --> 00:00:14,000
[SPEAKER 2]
Let's dive into the key features.`;

        // Set mock data
        setSourceTranscript(mockSourceTranscript);
        setTargetTranscript(mockTargetTranscript);
        setDetectedLanguage('en');
        setCurrentDubbingId('demo-mode-id');

        // Wait a moment for effect
        await new Promise(resolve => setTimeout(resolve, 1000));

        setIsLoading(false);
        setProgress('');
        setStep('edit-translation');
        return;
      }

      // PRODUCTION MODE: Full API workflow
      setProgress('🎬 Creating dubbing job with ElevenLabs Dubbing Studio...');

      const createResponse = await fetch('/api/dubbing/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: blob.url,
          targetLanguage: targetLanguage,
          sourceLanguage: undefined, // Let ElevenLabs auto-detect
          disableVoiceCloning: disableVoiceCloning,
          dropBackgroundAudio: dropBackgroundAudio,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create dubbing job');
      }

      const createData = await createResponse.json();
      const dubbingId = createData.dubbingId;
      const detectedSource = createData.sourceLanguage || 'en';

      console.log('Dubbing job created:', dubbingId);
      console.log('Detected source language:', detectedSource);

      setCurrentDubbingId(dubbingId);
      setDetectedLanguage(detectedSource);

      // Wait for dubbing to complete
      setProgress('⏳ Processing transcription and translation (2-5 minutes)...');
      await pollForDubbingCompletion(dubbingId, detectedSource);

    } catch (err) {
      console.error('Dubbing workflow error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Dubbing failed';
      setError(`Dubbing failed: ${errorMessage}`);
      setStep('upload');
      setIsLoading(false);
      setProgress('');
    }
  };

  const pollForDubbingCompletion = async (dubbingId: string, sourceLanguageCode: string) => {
    const maxPolls = 120; // 10 minutes max (120 * 5 seconds)
    let polls = 0;

    while (polls < maxPolls) {
      try {
        // Use the correct status endpoint for dubbing studio
        const statusResponse = await fetch(`/api/dubbing/status?dubbingId=${dubbingId}`);

        if (!statusResponse.ok) {
          throw new Error('Failed to check dubbing status');
        }

        const statusData = await statusResponse.json();

        console.log(`[Poll ${polls}] Status: ${statusData.status}`);

        // Show detailed progress
        const minutes = Math.floor(polls * 5 / 60);
        const seconds = (polls * 5) % 60;
        setProgress(`⏳ Processing transcription and translation (${minutes}m ${seconds}s elapsed)...`);

        if (statusData.status === 'dubbed' && statusData.ready) {
          console.log('✓ Dubbing complete! Fetching transcripts...');

          // Use detected source language from status if available
          const actualSourceLang = statusData.sourceLanguage || sourceLanguageCode;

          // Fetch both source and target transcripts
          await fetchTranscripts(dubbingId, actualSourceLang, targetLanguage);
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('Dubbing job failed');
        }

        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        polls++;
      } catch (error) {
        console.error('Polling error:', error);
        throw error;
      }
    }

    throw new Error('Dubbing timed out after 10 minutes');
  };

  const fetchTranscripts = async (dubbingId: string, sourceLanguageCode: string, targetLanguageCode: string) => {
    try {
      setProgress('📄 Fetching transcripts...');
      console.log(`Fetching transcripts for dubbing ${dubbingId}`);
      console.log(`Source language: ${sourceLanguageCode}, Target language: ${targetLanguageCode}`);

      // Fetch source transcript
      console.log('Fetching source transcript...');
      const sourceResponse = await fetch('/api/dubbing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dubbingId: dubbingId,
          languageCode: sourceLanguageCode,
          format: 'srt',
        }),
      });

      if (!sourceResponse.ok) {
        const errorData = await sourceResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Source transcript fetch failed:', errorData);
        throw new Error(`Failed to fetch source transcript: ${errorData.error || sourceResponse.statusText}`);
      }

      const sourceData = await sourceResponse.json();
      console.log('Source transcript received, length:', sourceData.transcript?.length || 0);
      setSourceTranscript(sourceData.transcript);
      setEditableTranscript(sourceData.transcript);
      setOriginalText(sourceData.transcript);

      // Fetch target transcript
      console.log('Fetching target transcript...');
      const targetResponse = await fetch('/api/dubbing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dubbingId: dubbingId,
          languageCode: targetLanguageCode,
          format: 'srt',
        }),
      });

      if (!targetResponse.ok) {
        const errorData = await targetResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Target transcript fetch failed:', errorData);
        throw new Error(`Failed to fetch target transcript: ${errorData.error || targetResponse.statusText}`);
      }

      const targetData = await targetResponse.json();
      console.log('Target transcript received, length:', targetData.transcript?.length || 0);
      setTargetTranscript(targetData.transcript);
      setTranslatedText(targetData.transcript);

      console.log('✓ Transcripts fetched successfully');
      setIsLoading(false);
      setProgress('');
      setStep('edit-english'); // Show transcript editing screen

    } catch (error) {
      console.error('Failed to fetch transcripts:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  };

  const translateScript = async () => {
    // Check if source and target languages are the same
    if (detectedLanguage === targetLanguage) {
      setError(`Cannot translate ${detectedLanguage.toUpperCase()} to ${languages.find(l => l.code === targetLanguage)?.name}. Please select a different target language.`);
      return;
    }

    setIsLoading(true);
    setError('');
    setProgress('Translating script to ' + languages.find(l => l.code === targetLanguage)?.name + '...');

    try {
      console.log('Translating script...');

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
        throw new Error(errorData.error || 'Translation failed');
      }

      const data = await response.json();

      console.log('Translation complete!');
      setTranslatedText(data.translatedText);
      setStep('edit-translation');

    } catch (err) {
      console.error('Translation error:', err);
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const completeDubbing = async () => {
    // DEMO MODE: Skip download and show demo complete screen
    if (demoMode) {
      console.log('🚀 DEMO MODE: Skipping video generation');
      setIsLoading(true);
      setProgress('✨ Demo mode: Preparing preview...');

      // Wait a moment for effect
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Use the uploaded video as the "generated" video for demo
      if (videoUrl) {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        setGeneratedVideo(blob);
      }

      setIsLoading(false);
      setProgress('');
      setStep('complete');
      return;
    }

    // PRODUCTION MODE: Download the dubbed video using the existing dubbing job
    if (!currentDubbingId) {
      setError('No dubbing ID found. Please start over.');
      return;
    }

    setIsLoading(true);
    setError('');
    setProgress('Downloading dubbed audio...');
    setStep('processing');

    try {
      console.log('Downloading dubbed audio from existing job:', currentDubbingId);

      // Download the dubbed audio directly from ElevenLabs
      const elevenLabsApiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

      if (!elevenLabsApiKey) {
        // Call our API to download and combine
        setProgress('📥 Fetching dubbed audio and combining with video...');

        const response = await fetch('/api/dubbing/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dubbingId: currentDubbingId,
            targetLanguage: targetLanguage,
            videoUrl: videoUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to download dubbed video');
        }

        const data = await response.json();

        if (!data.videoData) {
          throw new Error('API did not return video data.');
        }

        console.log('Video data received, size:', data.videoData.length, 'characters (base64)');

        // Convert base64 video to blob
        const videoBytes = Uint8Array.from(atob(data.videoData), c => c.charCodeAt(0));
        const videoBlob = new Blob([videoBytes], { type: 'video/mp4' });

        console.log('Video blob created, size:', videoBlob.size, 'bytes');

        setGeneratedVideo(videoBlob);
        setStep('complete');
      }

    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download video');
      setStep('edit-translation');
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
      setStep('edit-translation');
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ScriptShift
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your videos into any language with AI-powered voice cloning and dubbing
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-12 max-w-3xl mx-auto">
          {[
            { key: 'upload', label: 'Upload' },
            { key: 'edit-english', label: 'Review' },
            { key: 'edit-translation', label: 'Translate' },
            { key: 'complete', label: 'Done' }
          ].map((stepItem, i) => {
            const isActive = step === stepItem.key || (step === 'processing' && stepItem.key === 'complete');
            const isCompleted = ['upload', 'edit-english', 'edit-translation', 'processing', 'complete'].indexOf(step) >
              ['upload', 'edit-english', 'edit-translation', 'processing', 'complete'].indexOf(stepItem.key);

            return (
              <div key={stepItem.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg scale-110'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-400 border-2 border-gray-200'
                    }`}
                  >
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${isActive ? 'text-purple-600' : 'text-gray-500'}`}>
                    {stepItem.label}
                  </span>
                </div>
                {i < 3 && (
                  <div className={`h-1 flex-1 mx-2 rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-8 flex items-start gap-3 shadow-sm">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold mb-1">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {progress && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 px-6 py-4 rounded-2xl mb-8 flex items-center gap-4 shadow-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-b-3 border-purple-600"></div>
            <p className="text-blue-900 font-medium">{progress}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Upload Your Video</h2>
              <p className="text-gray-600">
                Upload your video and we'll automatically transcribe, translate, and dub it with AI voice cloning
              </p>
            </div>

            {/* Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-3 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
                videoFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              {videoFile ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900">{videoFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button className="text-purple-600 text-sm font-medium hover:underline">
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto">
                    <span className="text-4xl">📹</span>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-gray-900 mb-2">
                      Drop your video here
                    </p>
                    <p className="text-gray-500">or click to browse</p>
                  </div>
                  <p className="text-sm text-gray-400">
                    Supports MP4, MOV, AVI • Max 50MB
                  </p>
                </div>
              )}
            </div>

            {/* Language Selection */}
            <div className="mt-8">
              <label className="block text-lg font-semibold text-gray-900 mb-3">
                Select Target Language
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setTargetLanguage(lang.code)}
                    className={`p-4 rounded-2xl border-2 font-semibold transition-all duration-200 ${
                      targetLanguage === lang.code
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <div className="text-2xl mb-2">
                      {lang.code === 'en' && '🇬🇧'}
                      {lang.code === 'es' && '🇪🇸'}
                      {lang.code === 'fr' && '🇫🇷'}
                      {lang.code === 'it' && '🇮🇹'}
                    </div>
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Control Options */}
            <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🎤</span>
                Voice Control Options
              </h3>

              <div className="space-y-4">
                {/* Disable Voice Cloning */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-6">
                    <input
                      type="checkbox"
                      checked={disableVoiceCloning}
                      onChange={(e) => setDisableVoiceCloning(e.target.checked)}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 group-hover:text-purple-700 transition">
                      Disable Voice Cloning
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Use pre-designed synthetic voices from ElevenLabs Voice Library instead of cloning the original voices
                    </p>
                  </div>
                </label>

                {/* Drop Background Audio */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-6">
                    <input
                      type="checkbox"
                      checked={dropBackgroundAudio}
                      onChange={(e) => setDropBackgroundAudio(e.target.checked)}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 group-hover:text-purple-700 transition">
                      Remove Background Audio
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Strip background music and sound effects (recommended for speeches/monologues)
                    </p>
                  </div>
                </label>

                {/* Demo Mode */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-6">
                    <input
                      type="checkbox"
                      checked={demoMode}
                      onChange={(e) => setDemoMode(e.target.checked)}
                      className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 group-hover:text-orange-700 transition">
                      🚀 Demo Mode (Instant Preview)
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Skip API processing and use mock transcripts for instant UI testing (perfect for client demos)
                    </p>
                  </div>
                </label>
              </div>

              {disableVoiceCloning && (
                <div className="mt-4 bg-white border border-purple-300 rounded-xl p-4">
                  <p className="text-sm text-purple-800 font-medium">
                    ✓ Voice cloning is disabled. ElevenLabs will automatically select similar voices from their Voice Library.
                  </p>
                </div>
              )}

              {demoMode && (
                <div className="mt-4 bg-orange-50 border border-orange-300 rounded-xl p-4">
                  <p className="text-sm text-orange-800 font-medium">
                    🚀 <strong>Demo Mode Active:</strong> Will skip 6-minute processing and show instant mock transcripts for UI testing. Perfect for demos!
                  </p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">✨</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Dubbing Studio Workflow:</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• <strong>Step 1:</strong> AI transcribes original audio and detects speakers</li>
                    <li>• <strong>Step 2:</strong> AI translates to {languages.find(l => l.code === targetLanguage)?.name}</li>
                    <li>• <strong>Step 3:</strong> Review and edit transcripts (just like ElevenLabs UI)</li>
                    <li>• <strong>Step 4:</strong> Generate final dubbed video</li>
                    {disableVoiceCloning ? (
                      <li>• Voice: Using Voice Library synthetic voices</li>
                    ) : (
                      <li>• Voice: Professional cloning for each speaker</li>
                    )}
                    {dropBackgroundAudio ? (
                      <li>• Audio: Background removed</li>
                    ) : (
                      <li>• Audio: Background music preserved</li>
                    )}
                    <li>• <strong>Total time:</strong> 2-5 minutes processing + editing time</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <div className="mt-8">
              <button
                onClick={directDubbing}
                disabled={!videoFile || isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-5 px-8 rounded-2xl text-lg font-bold hover:shadow-xl hover:scale-[1.02] disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🎬 Start Dubbing</span>
                    <span>→</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Edit English Script */}
        {step === 'edit-english' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">📝 Edit English Script</h2>

            <div className={`border rounded-lg p-4 mb-6 ${
              detectedLanguage === targetLanguage
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-sm font-semibold mb-2 ${
                detectedLanguage === targetLanguage ? 'text-yellow-900' : 'text-blue-800'
              }`}>
                <strong>Detected Language:</strong> {detectedLanguage.toUpperCase()} → <strong>Target:</strong> {languages.find(l => l.code === targetLanguage)?.name}
              </p>
              {detectedLanguage === targetLanguage ? (
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Warning:</strong> Source and target languages are the same! Please select a different target language below.
                </p>
              ) : (
                <>
                  <p className="text-xs text-blue-600 mt-2">
                    ✏️ Review the video script below. The AI has identified speakers and added inferred on-screen text based on the dialogue.
                  </p>
                  <p className="text-xs text-blue-700 mt-1 font-medium">
                    📝 Add any missing [SUPER: "text"] or [LOCKUP: Brand] elements that appear in your video!
                  </p>
                </>
              )}
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 text-xs">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">[TITLE]</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">[SUPER]</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">[LOCKUP]</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">[SCENE]</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English Script
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

            {/* Target Language Selector */}
            {detectedLanguage && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Language (Change if needed)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setTargetLanguage(lang.code)}
                      disabled={lang.code === detectedLanguage}
                      className={`p-3 rounded-lg border-2 font-medium text-sm transition-all duration-200 ${
                        targetLanguage === lang.code
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : lang.code === detectedLanguage
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <div className="text-lg mb-1">
                        {lang.code === 'en' && '🇬🇧'}
                        {lang.code === 'es' && '🇪🇸'}
                        {lang.code === 'fr' && '🇫🇷'}
                        {lang.code === 'it' && '🇮🇹'}
                      </div>
                      {lang.name}
                      {lang.code === detectedLanguage && (
                        <div className="text-xs text-gray-500 mt-1">(Source)</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                ← Back
              </button>
              <button
                onClick={translateScript}
                disabled={isLoading || !editableTranscript.trim() || detectedLanguage === targetLanguage}
                className="flex-2 bg-blue-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {isLoading ? 'Translating...' : '🌍 Translate to ' + languages.find(l => l.code === targetLanguage)?.name}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Edit Translation (ElevenLabs UI Layout: Transcripts Left, Video Right) */}
        {step === 'edit-translation' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">📝 Dubbing Studio</h2>
              <p className="text-gray-600">Review and edit transcripts - Just like ElevenLabs UI</p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-green-900 font-semibold">
                <strong>Translation:</strong> {detectedLanguage.toUpperCase()} → {languages.find(l => l.code === targetLanguage)?.name}
                {demoMode && <span className="ml-3 bg-orange-500 text-white px-2 py-1 rounded text-xs">🚀 DEMO MODE</span>}
              </p>
            </div>

            {/* ElevenLabs Layout: Transcripts LEFT, Video RIGHT */}
            <div className="grid grid-cols-[1.5fr,1fr] gap-6 mb-6">
              {/* LEFT: Transcript Segments */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📄</span>
                  Transcripts & Translation
                </h3>

                {/* Original Transcript */}
                <div className="border-2 border-gray-300 rounded-2xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎤</span>
                    <label className="text-sm font-bold text-gray-900">
                      Original ({detectedLanguage.toUpperCase()})
                    </label>
                    <span className="text-xs text-gray-500 ml-auto">
                      {sourceTranscript.length} chars
                    </span>
                  </div>
                  <textarea
                    value={sourceTranscript}
                    onChange={(e) => setSourceTranscript(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs leading-relaxed bg-white resize-none"
                    placeholder="Original transcript..."
                    style={{ lineHeight: '1.6' }}
                  />
                </div>

                {/* Translation */}
                <div className="border-2 border-green-400 rounded-2xl p-4 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🌍</span>
                    <label className="text-sm font-bold text-gray-900">
                      Translation ({languages.find(l => l.code === targetLanguage)?.name})
                    </label>
                    <span className="text-xs text-gray-500 ml-auto">
                      {targetTranscript.length} chars
                    </span>
                  </div>
                  <textarea
                    value={targetTranscript}
                    onChange={(e) => setTargetTranscript(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-xs leading-relaxed bg-white resize-none"
                    placeholder="Translated transcript..."
                    style={{ lineHeight: '1.6' }}
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    ✏️ Edit the translation freely - AI will re-generate dubbed audio with your changes
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Tip:</strong> Transcripts are in SRT format with timestamps and speaker labels. Edit text while keeping timing structure.
                  </p>
                </div>
              </div>

              {/* RIGHT: Video Player & Controls */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>🎬</span>
                  Video Preview
                </h3>

                {/* Video Player */}
                <div className="border-2 border-gray-300 rounded-2xl p-4 bg-gray-50">
                  {videoUrl ? (
                    <div>
                      <video
                        controls
                        className="w-full rounded-lg shadow-lg"
                        style={{ maxHeight: '400px' }}
                      >
                        <source src={videoUrl} type="video/mp4" />
                      </video>
                      <p className="text-xs text-gray-600 mt-2 text-center">
                        Original video preview
                      </p>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <span className="text-4xl">🎥</span>
                        <p className="text-sm mt-2">Video preview</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Voice Selector */}
                <div className="border-2 border-purple-300 rounded-2xl p-4 bg-purple-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🎙️</span>
                    <label className="text-sm font-bold text-gray-900">
                      Voice Selection
                    </label>
                  </div>

                  {availableVoices.length > 0 ? (
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    >
                      <option value="">Auto-select voice</option>
                      {availableVoices.map((voice) => (
                        <option key={voice.voice_id} value={voice.voice_id}>
                          {voice.name} ({voice.voice_id.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={fetchAvailableVoices}
                      className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
                    >
                      Load Available Voices
                    </button>
                  )}

                  <p className="text-xs text-gray-600 mt-2">
                    Select a custom voice from your ElevenLabs Voice Library
                  </p>
                </div>

                {/* Audio-Only Download Option */}
                <div className="border-2 border-orange-300 rounded-2xl p-4 bg-orange-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎵</span>
                    <label className="text-sm font-bold text-gray-900">
                      Audio-Only Export
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Download just the dubbed audio track for custom mixing in your video editor
                  </p>
                  <button
                    onClick={downloadAudioOnly}
                    disabled={isLoading || !videoUrl || demoMode}
                    className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {isLoading ? 'Downloading...' : '🎵 Download Audio Only'}
                  </button>
                  {demoMode && (
                    <p className="text-xs text-orange-700 mt-2 text-center">
                      Not available in demo mode
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-gray-200 text-gray-700 py-4 px-8 rounded-2xl font-bold hover:bg-gray-300 transition shadow-sm"
              >
                ← Start Over
              </button>
              <button
                onClick={completeDubbing}
                disabled={(isLoading || !targetTranscript.trim()) && !demoMode}
                className="flex-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-12 rounded-2xl font-bold hover:shadow-xl hover:scale-[1.02] disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generating Video...
                  </span>
                ) : demoMode ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>✨ Complete Demo</span>
                    <span>→</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🎬 Generate Final Video</span>
                    <span>→</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Processing */}
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
            <h2 className="text-2xl font-semibold mb-4 text-green-600 flex items-center gap-2">
              ✓ Localization Complete!
              {demoMode && (
                <span className="text-sm bg-orange-500 text-white px-3 py-1 rounded-lg">🚀 DEMO MODE</span>
              )}
            </h2>

            {demoMode && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 mb-6">
                <p className="text-sm text-orange-900 font-semibold mb-2">
                  🚀 Demo Mode Active
                </p>
                <p className="text-xs text-orange-800">
                  You're viewing a demo preview with mock transcripts. In production mode, this would be your fully dubbed video with AI-generated multilingual audio.
                </p>
              </div>
            )}

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

              {/* Dubbed Video */}
              {generatedVideo && (
                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <h3 className="font-semibold mb-2 text-green-900">🎬 Dubbed Video</h3>
                  <p className="text-xs text-green-700 mb-3">
                    Your video with AI-translated {languages.find(l => l.code === targetLanguage)?.name} audio
                  </p>
                  <video controls className="w-full rounded mb-4">
                    <source src={URL.createObjectURL(generatedVideo)} type="video/mp4" />
                  </video>
                  <div className="flex gap-3">
                    <a
                      href={URL.createObjectURL(generatedVideo)}
                      download={`dubbed-video-${targetLanguage}.mp4`}
                      className="flex-1 text-center bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition shadow-sm"
                    >
                      📥 Download Video
                    </a>
                    <button
                      onClick={downloadAudioOnly}
                      disabled={isLoading || demoMode}
                      className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-sm"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Downloading...
                        </span>
                      ) : demoMode ? (
                        '🎵 Audio Only (Demo Mode)'
                      ) : (
                        '🎵 Download Audio Only'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-3 text-center">
                    Download audio separately for custom mixing in your video editor
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
