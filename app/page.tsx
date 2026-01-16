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

type Step = 'upload' | 'voice-selection' | 'processing' | 'complete';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [useDubbingStudio, setUseDubbingStudio] = useState(true); // Default to dubbing studio
  const [dubbingId, setDubbingId] = useState<string>('');
  const [voiceRecommendations, setVoiceRecommendations] = useState<VoiceRecommendations | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<Blob | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
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

  const pollDubbingStatus = async (jobId: string) => {
    const maxPolls = 60; // 5 minutes max (60 * 5 seconds)
    let polls = 0;

    while (polls < maxPolls) {
      try {
        const response = await fetch(`/api/dub-video/status?dubbingId=${jobId}`);
        const data = await response.json();

        console.log('Dubbing status:', data.status);
        setProgress(`Dubbing status: ${data.status}...`);

        if (data.ready) {
          // Download the dubbed video
          const videoUrl = `/api/dub-video/download?dubbingId=${jobId}&targetLanguage=${targetLanguage}`;
          const videoResponse = await fetch(videoUrl);
          const videoBlob = await videoResponse.blob();
          setGeneratedVideo(videoBlob);
          return;
        }

        if (data.status === 'failed') {
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

    throw new Error('Dubbing timed out');
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

            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Dubbing Method
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    {useDubbingStudio
                      ? 'Automatic dubbing with lip-sync (recommended)'
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
            </div>

            <button
              onClick={useDubbingStudio ? dubVideoWithStudio : analyzeVoice}
              disabled={!videoFile || isLoading}
              className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isLoading
                ? (useDubbingStudio ? 'Dubbing in progress...' : 'Analyzing...')
                : (useDubbingStudio ? 'Start Auto Dubbing' : 'Analyze Video & Find Voices')}
            </button>
          </div>
        )}

        {/* Step 2: Voice Selection */}
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
