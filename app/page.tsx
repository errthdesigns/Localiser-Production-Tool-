'use client';

import { useState, useRef, useEffect } from 'react';

type Screen = 'upload' | 'transcript' | 'progress' | 'output';

interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
  confidence?: number;
}

interface Transcript {
  id: number;
  job_id: string;
  file_hash: string;
  language: string;
  speakers: string[];
  segments: TranscriptSegment[];
  created_at: number;
}

interface VoiceMapping {
  speakerId: string;
  speakerName?: string;
  voiceId: string;
  voiceName?: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [dubbingId, setDubbingId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Transcript data
  const [sourceTranscript, setSourceTranscript] = useState<Transcript | null>(null);
  const [targetTranscript, setTargetTranscript] = useState<Transcript | null>(null);
  const [editedSegments, setEditedSegments] = useState<TranscriptSegment[]>([]);

  // Voice mappings
  const [voiceMappings, setVoiceMappings] = useState<Map<string, VoiceMapping>>(new Map());
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);

  // Progress
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Output
  const [outputVideoUrl, setOutputVideoUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const languages = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ];

  // Fetch available voices on mount
  useEffect(() => {
    fetchVoices();
  }, []);

  const fetchVoices = async () => {
    try {
      const response = await fetch('/api/elevenlabs/voices');
      if (response.ok) {
        const data = await response.json();
        setAvailableVoices(data.voices || []);
      }
    } catch (err) {
      console.error('Failed to fetch voices:', err);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
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

  const handleUpload = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError('');

    try {
      // Send video DIRECTLY to ElevenLabs (no Blob storage - faster!)
      setProgressStage('Starting dubbing...');

      const formData = new FormData();
      formData.append('file', videoFile);
      formData.append('targetLanguage', targetLanguage);
      formData.append('sourceLanguage', 'auto');
      formData.append('dropBackgroundAudio', 'false');

      const dubbingResponse = await fetch('/api/dubbing/create', {
        method: 'POST',
        body: formData
      });

      if (!dubbingResponse.ok) {
        const errorData = await dubbingResponse.json();
        throw new Error(errorData.error || 'Failed to create dubbing job');
      }

      const dubbingData = await dubbingResponse.json();
      setDubbingId(dubbingData.dubbingId);

      // Store video URL from response (if provided)
      if (dubbingData.videoUrl) {
        setVideoUrl(dubbingData.videoUrl);
      }

      // Start polling for dubbing status
      startPolling(dubbingData.dubbingId);

      setScreen('progress');

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (id: string) => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    const startTime = Date.now();
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    pollInterval.current = setInterval(async () => {
      try {
        // Check for timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          clearInterval(pollInterval.current!);
          setError('Dubbing timed out after 10 minutes. Please try again with a shorter video.');
          setScreen('upload');
          return;
        }

        const response = await fetch(`/api/dubbing/status?dubbingId=${id}`);
        const data = await response.json();

        console.log('[Polling] Status response:', data); // DEBUG

        setJobStatus(data);

        // Update progress based on actual status
        let stage = '';
        let percent = 0;

        switch (data.status) {
          case 'pending':
            stage = 'Starting dubbing job...';
            percent = 10;
            break;
          case 'preparing':
            stage = 'Preparing audio and video...';
            percent = 30;
            break;
          case 'dubbing':
            stage = 'Dubbing in progress...';
            percent = 60;
            break;
          case 'dubbed':
            stage = 'Complete!';
            percent = 100;
            break;
          default:
            stage = `Processing (${data.status})`;
            percent = 50;
        }

        setProgressStage(stage);
        setProgressPercent(percent);

        // Check for failed status
        if (data.status === 'failed') {
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }
          setError(`Dubbing failed: ${data.error || 'Unknown error'}. Please try again.`);
          setScreen('upload');
          return;
        }

        if (data.status === 'dubbed' || data.ready === true) {
          // Stop polling
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }

          console.log('[Polling] Dubbing complete! Fetching transcripts and video...');

          // Fetch transcripts AND download video
          try {
            setProgressStage('Loading transcripts and video...');

            // Load both transcripts in parallel
            const [sourceResp, targetResp, downloadResp] = await Promise.all([
              fetch('/api/dubbing/transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dubbingId: id, languageCode: 'en', format: 'json' })
              }),
              fetch('/api/dubbing/transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dubbingId: id, languageCode: targetLanguage, format: 'json' })
              }),
              fetch('/api/dubbing/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dubbingId: id, targetLanguage, videoUrl })
              })
            ]);

            // Process transcripts
            if (sourceResp.ok) {
              const sourceData = await sourceResp.json();
              setSourceTranscript(sourceData.transcript);
            }

            if (targetResp.ok) {
              const targetData = await targetResp.json();
              setTargetTranscript(targetData.transcript);
            }

            // Process video
            if (downloadResp.ok) {
              const downloadData = await downloadResp.json();
              const videoData = downloadData.videoData;
              const byteCharacters = atob(videoData);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'video/mp4' });
              const url = URL.createObjectURL(blob);
              setOutputVideoUrl(url);
            }

            setScreen('output');
          } catch (err) {
            console.error('Loading error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load results');
          }
        } else if (data.status === 'failed') {
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }
          setError('Dubbing failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000); // Poll every 2 seconds
  };

  const loadTranscripts = async (id: string) => {
    try {
      // Load source transcript (English)
      const sourceResp = await fetch('/api/dubbing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dubbingId: id, languageCode: 'en', format: 'json' })
      });
      if (sourceResp.ok) {
        const sourceData = await sourceResp.json();
        setSourceTranscript(sourceData.transcript);
      }

      // Load target transcript
      const targetResp = await fetch('/api/dubbing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dubbingId: id, languageCode: targetLanguage, format: 'json' })
      });
      if (targetResp.ok) {
        const targetData = await targetResp.json();
        setTargetTranscript(targetData.transcript);
        setEditedSegments(targetData.transcript.segments);

        // Initialize voice mappings with default voice
        const defaultVoice = availableVoices[0];
        const mappings = new Map<string, VoiceMapping>();
        targetData.transcript.speakers.forEach((speaker: string) => {
          mappings.set(speaker, {
            speakerId: speaker,
            voiceId: defaultVoice?.voice_id || 'EXAVITQu4vr4xnSDxMaL',
            voiceName: defaultVoice?.name || 'Sarah'
          });
        });
        setVoiceMappings(mappings);
      }
    } catch (err) {
      console.error('Failed to load transcripts:', err);
      setError('Failed to load transcripts');
    }
  };

  const updateSegmentText = (index: number, newText: string) => {
    const updated = [...editedSegments];
    updated[index] = { ...updated[index], text: newText };
    setEditedSegments(updated);
  };

  const setVoiceForSpeaker = (speakerId: string, voiceId: string) => {
    const voice = availableVoices.find(v => v.voice_id === voiceId);
    const updated = new Map(voiceMappings);
    updated.set(speakerId, {
      speakerId,
      voiceId,
      voiceName: voice?.name
    });
    setVoiceMappings(updated);
  };

  const saveTranscriptAndGenerate = async () => {
    if (!dubbingId || !targetTranscript) return;

    setIsLoading(true);
    setError('');

    try {
      // Download the final dubbed video
      const downloadResponse = await fetch('/api/dubbing/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dubbingId,
          targetLanguage,
          videoUrl
        })
      });

      if (!downloadResponse.ok) {
        throw new Error('Failed to download dubbed video');
      }

      const downloadData = await downloadResponse.json();

      // Convert base64 to blob URL for download
      const videoData = downloadData.videoData;
      const byteCharacters = atob(videoData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setOutputVideoUrl(url);
      setScreen('output');

    } catch (err) {
      console.error('Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <p className="text-xl text-gray-600">
            AI-powered video dubbing with voice cloning
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-8 max-w-4xl mx-auto">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Upload Screen */}
        {screen === 'upload' && (
          <div className="bg-white rounded-3xl shadow-xl p-10 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Upload Your Video</h2>

            {/* Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-3 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
                videoFile ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-purple-400'
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
                  <p className="text-xl font-semibold">{videoFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>

                  {/* Video Preview */}
                  {videoUrl && (
                    <div className="mt-4">
                      <video
                        src={videoUrl}
                        controls
                        className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
                        style={{ maxHeight: '300px' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto">
                    <span className="text-4xl">📹</span>
                  </div>
                  <div>
                    <p className="text-xl font-semibold mb-2">Drop your video here</p>
                    <p className="text-gray-500">or click to browse</p>
                  </div>
                  <p className="text-sm text-gray-400">MP4, MOV, AVI • Max 50MB</p>
                </div>
              )}
            </div>

            {/* Language Selection */}
            <div className="mt-8">
              <label className="block text-lg font-semibold mb-3">Target Language</label>
              <div className="grid grid-cols-4 gap-3">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setTargetLanguage(lang.code)}
                    className={`p-4 rounded-2xl border-2 font-semibold transition ${
                      targetLanguage === lang.code
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{lang.flag}</div>
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!videoFile || isLoading}
              className="w-full mt-8 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-5 rounded-2xl text-lg font-bold hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 transition"
            >
              {isLoading ? 'Uploading...' : '🚀 Start Dubbing'}
            </button>
          </div>
        )}

        {/* Progress Screen */}
        {screen === 'progress' && (
          <div className="bg-white rounded-3xl shadow-xl p-10 max-w-2xl mx-auto text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">Processing Your Video</h2>
            <p className="text-gray-600 mb-6">{progressStage || 'Initializing...'}</p>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">{progressPercent}% complete</p>
          </div>
        )}

        {/* Transcript Editor Screen */}
        {screen === 'transcript' && targetTranscript && (
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <h2 className="text-3xl font-bold mb-6">Edit Transcripts & Assign Voices</h2>

            <div className="grid grid-cols-2 gap-8">
              {/* Left: Video Preview */}
              <div>
                <h3 className="text-lg font-bold mb-3">Video Preview</h3>
                {videoUrl && (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full rounded-lg shadow-lg mb-4"
                  />
                )}

                {/* Speakers & Voice Assignment */}
                <div className="mt-6">
                  <h4 className="font-bold mb-3">Speaker Voice Assignment</h4>
                  {targetTranscript.speakers.map((speaker) => (
                    <div key={speaker} className="mb-4 p-4 border rounded-lg">
                      <label className="block font-semibold mb-2">{speaker}</label>
                      <select
                        value={voiceMappings.get(speaker)?.voiceId || ''}
                        onChange={(e) => setVoiceForSpeaker(speaker, e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        {availableVoices.map((voice) => (
                          <option key={voice.voice_id} value={voice.voice_id}>
                            {voice.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Transcript Segments */}
              <div className="max-h-[600px] overflow-y-auto">
                <h3 className="text-lg font-bold mb-3">Translated Transcript ({languages.find(l => l.code === targetLanguage)?.name})</h3>
                {editedSegments.map((segment, index) => (
                  <div key={index} className="mb-4 p-4 border-2 border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                      <span className="font-semibold">{segment.speaker}</span>
                      <span>•</span>
                      <span>{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                    </div>
                    <textarea
                      value={segment.text}
                      onChange={(e) => updateSegmentText(index, e.target.value)}
                      rows={3}
                      className="w-full p-2 border rounded font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={saveTranscriptAndGenerate}
              disabled={isLoading}
              className="w-full mt-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-5 rounded-2xl text-lg font-bold hover:shadow-xl disabled:bg-gray-400 transition"
            >
              {isLoading ? 'Saving...' : '🎬 Generate Dubbed Video'}
            </button>
          </div>
        )}

        {/* Output Screen */}
        {screen === 'output' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-green-600 mb-6">✓ Dubbing Complete!</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Dubbed Video */}
              {outputVideoUrl && (
                <div>
                  <h3 className="text-lg font-bold mb-2">Dubbed Video</h3>
                  <video
                    src={outputVideoUrl}
                    controls
                    className="w-full rounded-lg shadow-lg"
                  />
                </div>
              )}

              {/* Transcripts */}
              <div className="space-y-4">
                {sourceTranscript && (
                  <div>
                    <h3 className="text-lg font-bold mb-2">Original (English)</h3>
                    <div className="bg-gray-100 p-4 rounded-lg h-64 overflow-y-auto text-sm">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(sourceTranscript, null, 2)}</pre>
                    </div>
                  </div>
                )}
                {targetTranscript && (
                  <div>
                    <h3 className="text-lg font-bold mb-2">Translated ({targetLanguage.toUpperCase()})</h3>
                    <div className="bg-blue-50 p-4 rounded-lg h-64 overflow-y-auto text-sm">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(targetTranscript, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <a
                href={outputVideoUrl}
                download="dubbed-video.mp4"
                className="flex-1 text-center bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition"
              >
                📥 Download Video
              </a>
              <button
                onClick={() => {
                  setScreen('upload');
                  setVideoFile(null);
                  setVideoUrl('');
                  setDubbingId('');
                }}
                className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition"
              >
                Process Another Video
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
