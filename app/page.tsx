'use client';

import { useState, useRef } from 'react';

type Step = 'upload' | 'processing' | 'review' | 'lipsync' | 'complete';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState('');

  // Dubbing results
  const [dubbingId, setDubbingId] = useState<string>('');
  const [sourceTranscript, setSourceTranscript] = useState<string>('');
  const [targetTranscript, setTargetTranscript] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [dubbedVideo, setDubbedVideo] = useState<Blob | null>(null);
  const [dubbedVideoUrl, setDubbedVideoUrl] = useState<string>('');

  // Lip-sync results
  const [lipsyncJobId, setLipsyncJobId] = useState<string>('');
  const [lipsyncedVideo, setLipsyncedVideo] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
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

  const processVideo = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError('');
    setStep('processing');

    try {
      const fileSizeMB = videoFile.size / 1024 / 1024;

      if (fileSizeMB > 50) {
        setError(`Video file is ${fileSizeMB.toFixed(2)}MB. Maximum file size is 50MB.`);
        setIsLoading(false);
        setStep('upload');
        return;
      }

      // Step 1: Upload to Vercel Blob
      setProgress('📤 Uploading video...');
      const { upload } = await import('@vercel/blob/client');
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileExt = videoFile.name.split('.').pop();
      const baseName = videoFile.name.replace(`.${fileExt}`, '');
      const uniqueFileName = `${baseName}-${timestamp}-${randomStr}.${fileExt}`;

      const blob = await upload(uniqueFileName, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      console.log('Video uploaded:', blob.url);
      setVideoUrl(blob.url);

      // Step 2: Create ElevenLabs dubbing job
      setProgress('🎬 Creating dubbing job (transcribe + translate + dub)...');
      const createResponse = await fetch('/api/dubbing/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: blob.url,
          targetLanguage: targetLanguage,
          sourceLanguage: undefined, // Auto-detect
          disableVoiceCloning: false, // Enable voice cloning
          dropBackgroundAudio: false, // KEEP background audio
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create dubbing job');
      }

      const createData = await createResponse.json();
      const dubbingJobId = createData.dubbingId;
      const sourceLanguage = createData.sourceLanguage || 'en';

      console.log('Dubbing job created:', dubbingJobId);
      setDubbingId(dubbingJobId);
      setDetectedLanguage(sourceLanguage);

      // Step 3: Poll for dubbing completion
      setProgress('⏳ Processing dubbing (2-5 minutes)...');
      await pollDubbingStatus(dubbingJobId, sourceLanguage);

    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('upload');
      setIsLoading(false);
      setProgress('');
    }
  };

  const pollDubbingStatus = async (jobId: string, sourceLanguage: string) => {
    const maxPolls = 120; // 10 minutes
    let polls = 0;

    while (polls < maxPolls) {
      try {
        const statusResponse = await fetch(`/api/dubbing/status?dubbingId=${jobId}`);

        if (!statusResponse.ok) {
          throw new Error('Failed to check dubbing status');
        }

        const statusData = await statusResponse.json();
        const minutes = Math.floor(polls * 5 / 60);
        const seconds = (polls * 5) % 60;
        setProgress(`⏳ Processing dubbing (${minutes}m ${seconds}s elapsed)...`);

        console.log(`[Poll ${polls}] Status: ${statusData.status}`);

        if (statusData.status === 'dubbed' && statusData.ready) {
          console.log('✓ Dubbing complete!');

          // Fetch transcripts
          await fetchTranscriptsAndVideo(jobId, sourceLanguage, targetLanguage);
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('Dubbing job failed');
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        polls++;
      } catch (error) {
        console.error('Polling error:', error);
        throw error;
      }
    }

    throw new Error('Dubbing timed out after 10 minutes');
  };

  const fetchTranscriptsAndVideo = async (jobId: string, sourceLanguage: string, targetLanguage: string) => {
    try {
      setProgress('📄 Fetching transcripts...');

      // Fetch source transcript
      const sourceResponse = await fetch('/api/dubbing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dubbingId: jobId,
          languageCode: sourceLanguage,
          format: 'srt',
        }),
      });

      if (!sourceResponse.ok) {
        throw new Error('Failed to fetch source transcript');
      }

      const sourceData = await sourceResponse.json();
      setSourceTranscript(sourceData.transcript);

      // Fetch target transcript
      const targetResponse = await fetch('/api/dubbing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dubbingId: jobId,
          languageCode: targetLanguage,
          format: 'srt',
        }),
      });

      if (!targetResponse.ok) {
        throw new Error('Failed to fetch target transcript');
      }

      const targetData = await targetResponse.json();
      setTargetTranscript(targetData.transcript);

      // Download dubbed video
      setProgress('📥 Downloading dubbed video...');
      const downloadResponse = await fetch('/api/dubbing/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dubbingId: jobId,
          targetLanguage: targetLanguage,
          videoUrl: videoUrl,
        }),
      });

      if (!downloadResponse.ok) {
        throw new Error('Failed to download dubbed video');
      }

      const downloadData = await downloadResponse.json();
      const videoBytes = Uint8Array.from(atob(downloadData.videoData), c => c.charCodeAt(0));
      const videoBlob = new Blob([videoBytes], { type: 'video/mp4' });

      setDubbedVideo(videoBlob);
      const dubbedUrl = URL.createObjectURL(videoBlob);
      setDubbedVideoUrl(dubbedUrl);

      console.log('✓ Dubbed video ready');
      setIsLoading(false);
      setProgress('');
      setStep('review');

    } catch (error) {
      console.error('Failed to fetch transcripts/video:', error);
      throw error;
    }
  };

  const startLipSync = async () => {
    if (!dubbedVideoUrl) {
      setError('No dubbed video available');
      return;
    }

    setIsLoading(true);
    setError('');
    setStep('lipsync');
    setProgress('🎭 Uploading to HeyGen for lip-sync...');

    try {
      // Upload dubbed video to HeyGen
      const lipsyncResponse = await fetch('/api/heygen/lipsync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: dubbedVideoUrl,
        }),
      });

      if (!lipsyncResponse.ok) {
        const errorData = await lipsyncResponse.json();
        throw new Error(errorData.error || 'Failed to start lip-sync');
      }

      const lipsyncData = await lipsyncResponse.json();
      const jobId = lipsyncData.jobId;

      console.log('HeyGen lip-sync job created:', jobId);
      setLipsyncJobId(jobId);

      // Poll for lip-sync completion
      setProgress('⏳ HeyGen is processing lip-sync (2-5 minutes)...');
      await pollLipsyncStatus(jobId);

    } catch (err) {
      console.error('Lip-sync error:', err);
      setError(err instanceof Error ? err.message : 'Lip-sync failed');
      setStep('review');
      setIsLoading(false);
      setProgress('');
    }
  };

  const pollLipsyncStatus = async (jobId: string) => {
    const maxPolls = 120; // 10 minutes
    let polls = 0;

    while (polls < maxPolls) {
      try {
        const statusResponse = await fetch(`/api/heygen/status?jobId=${jobId}`);

        if (!statusResponse.ok) {
          throw new Error('Failed to check lip-sync status');
        }

        const statusData = await statusResponse.json();
        const minutes = Math.floor(polls * 5 / 60);
        const seconds = (polls * 5) % 60;
        const progressPercent = statusData.progress || 0;
        setProgress(`⏳ HeyGen lip-sync processing (${minutes}m ${seconds}s, ${progressPercent}% complete)...`);

        console.log(`[Poll ${polls}] Status: ${statusData.status}, Progress: ${progressPercent}%`);

        if (statusData.status === 'completed' && statusData.ready) {
          console.log('✓ Lip-sync complete!');

          // Download lip-synced video
          const videoResponse = await fetch(statusData.videoUrl);
          const videoBlob = await videoResponse.blob();
          setLipsyncedVideo(videoBlob);

          setIsLoading(false);
          setProgress('');
          setStep('complete');
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('Lip-sync job failed');
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        polls++;
      } catch (error) {
        console.error('Lip-sync polling error:', error);
        throw error;
      }
    }

    throw new Error('Lip-sync timed out after 10 minutes');
  };

  const downloadAudio = async () => {
    if (!dubbingId) {
      setError('No dubbing ID available');
      return;
    }

    try {
      setProgress('📥 Downloading audio...');

      // Download audio-only from ElevenLabs
      const response = await fetch('/api/translate-and-dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          targetLanguage: targetLanguage,
          audioOnly: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to download audio');
      }

      const data = await response.json();
      const audioBytes = Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

      // Trigger download
      const downloadUrl = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `dubbed-audio-${targetLanguage}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setProgress('');
    } catch (err) {
      console.error('Audio download error:', err);
      setError(err instanceof Error ? err.message : 'Audio download failed');
      setProgress('');
    }
  };

  const reset = () => {
    setStep('upload');
    setVideoFile(null);
    setVideoUrl('');
    setDubbingId('');
    setSourceTranscript('');
    setTargetTranscript('');
    setDetectedLanguage('');
    setDubbedVideo(null);
    setDubbedVideoUrl('');
    setLipsyncJobId('');
    setLipsyncedVideo(null);
    setError('');
    setProgress('');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
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
            AI-powered video dubbing with voice cloning and lip-sync
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-8 flex items-start gap-3 shadow-sm max-w-4xl mx-auto">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold mb-1">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {progress && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 px-6 py-4 rounded-2xl mb-8 flex items-center gap-4 shadow-sm max-w-4xl mx-auto">
            <div className="animate-spin rounded-full h-6 w-6 border-b-3 border-purple-600"></div>
            <p className="text-blue-900 font-medium">{progress}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-3xl shadow-xl p-10 border border-gray-100 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Upload Your Video</h2>

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
                    <div className="text-2xl mb-2">{lang.flag}</div>
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">✨</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Workflow:</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• <strong>Step 1:</strong> AI transcribes and detects speakers</li>
                    <li>• <strong>Step 2:</strong> Translates to {languages.find(l => l.code === targetLanguage)?.name}</li>
                    <li>• <strong>Step 3:</strong> Dubs video with AI voice cloning (background audio preserved)</li>
                    <li>• <strong>Step 4:</strong> HeyGen lip-syncs video to match new audio</li>
                    <li>• <strong>Step 5:</strong> Download audio or full video</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <div className="mt-8">
              <button
                onClick={processVideo}
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
                    <span>🚀 Start Processing</span>
                    <span>→</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-2xl mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">Processing Your Video</h2>
            <p className="text-gray-600">Transcribing, translating, and dubbing...</p>
          </div>
        )}

        {/* Step 3: Review Dubbed Video */}
        {step === 'review' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Review Dubbed Video</h2>

            {/* Video and Transcripts Side by Side */}
            <div className="grid grid-cols-[1fr,1fr] gap-6 mb-6">
              {/* Left: Dubbed Video */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>🎬</span>
                  Dubbed Video (Voice Changed, Background Preserved)
                </h3>
                {dubbedVideo && (
                  <div className="border-2 border-green-300 rounded-2xl p-4 bg-green-50">
                    <video
                      controls
                      className="w-full rounded-lg shadow-lg"
                      style={{ maxHeight: '400px' }}
                    >
                      <source src={dubbedVideoUrl} type="video/mp4" />
                    </video>
                    <p className="text-xs text-green-800 mt-3 text-center font-semibold">
                      ✓ Voices translated to {languages.find(l => l.code === targetLanguage)?.name} • Background audio preserved
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Transcripts */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📄</span>
                  Transcripts
                </h3>

                {/* Original */}
                <div className="border-2 border-gray-300 rounded-2xl p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🎤</span>
                    <label className="text-xs font-bold text-gray-900">
                      Original ({detectedLanguage.toUpperCase()})
                    </label>
                  </div>
                  <textarea
                    value={sourceTranscript}
                    readOnly
                    rows={8}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg font-mono text-xs leading-relaxed bg-white resize-none"
                    style={{ lineHeight: '1.5' }}
                  />
                </div>

                {/* Translation */}
                <div className="border-2 border-green-400 rounded-2xl p-3 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🌍</span>
                    <label className="text-xs font-bold text-gray-900">
                      Translation ({languages.find(l => l.code === targetLanguage)?.name})
                    </label>
                  </div>
                  <textarea
                    value={targetTranscript}
                    readOnly
                    rows={8}
                    className="w-full px-2 py-2 border border-green-400 rounded-lg font-mono text-xs leading-relaxed bg-white resize-none"
                    style={{ lineHeight: '1.5' }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={reset}
                className="flex-1 bg-gray-200 text-gray-700 py-4 px-8 rounded-2xl font-bold hover:bg-gray-300 transition"
              >
                ← Start Over
              </button>
              <button
                onClick={downloadAudio}
                disabled={isLoading}
                className="flex-1 bg-orange-600 text-white py-4 px-8 rounded-2xl font-bold hover:bg-orange-700 disabled:bg-gray-400 transition"
              >
                🎵 Download Audio Only
              </button>
              <button
                onClick={startLipSync}
                disabled={isLoading}
                className="flex-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-12 rounded-2xl font-bold hover:shadow-xl hover:scale-[1.02] disabled:from-gray-400 disabled:to-gray-400 transition-all duration-200"
              >
                🎭 Generate Lip-Synced Video →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Lip-Sync Processing */}
        {step === 'lipsync' && (
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-2xl mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">HeyGen Lip-Sync Processing</h2>
            <p className="text-gray-600">Creating perfectly synced video...</p>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-3xl font-bold text-green-600 mb-6 flex items-center gap-2">
              ✓ Complete!
            </h2>

            {/* Final Lip-Synced Video */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🎬 Final Lip-Synced Video</h3>
              {lipsyncedVideo && (
                <div className="border-2 border-green-400 rounded-2xl p-4 bg-green-50">
                  <video
                    controls
                    className="w-full rounded-lg shadow-lg"
                    style={{ maxHeight: '500px' }}
                  >
                    <source src={URL.createObjectURL(lipsyncedVideo)} type="video/mp4" />
                  </video>
                  <p className="text-sm text-green-800 mt-3 text-center font-semibold">
                    ✓ Fully dubbed and lip-synced in {languages.find(l => l.code === targetLanguage)?.name}
                  </p>
                </div>
              )}
            </div>

            {/* Download Buttons */}
            <div className="flex gap-4 mb-6">
              <a
                href={lipsyncedVideo ? URL.createObjectURL(lipsyncedVideo) : '#'}
                download={`final-lipsync-${targetLanguage}.mp4`}
                className="flex-1 text-center bg-green-600 text-white py-4 px-8 rounded-2xl font-bold hover:bg-green-700 transition"
              >
                📥 Download Full Video
              </a>
              <button
                onClick={downloadAudio}
                className="flex-1 bg-purple-600 text-white py-4 px-8 rounded-2xl font-bold hover:bg-purple-700 transition"
              >
                🎵 Download Audio Only
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={reset}
              className="w-full bg-blue-600 text-white py-4 px-8 rounded-2xl font-bold hover:bg-blue-700 transition"
            >
              Process Another Video
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
