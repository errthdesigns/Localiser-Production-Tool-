import React, { useState } from 'react';
import { Upload, Globe, Layers, Eye, Download, ChevronRight, ChevronLeft, Check, AlertCircle, Play, Pause, FileVideo, Type, Image, MessageSquare, Package, X, Edit3, Maximize2, Loader2, Mic, RefreshCw } from 'lucide-react';

// Mock data
const MARKETS = [
  { code: 'DE', name: 'Germany', language: 'German', flag: '🇩🇪', hasApprovedPack: true },
  { code: 'FR', name: 'France', language: 'French', flag: '🇫🇷', hasApprovedPack: true },
  { code: 'ES', name: 'Spain', language: 'Spanish', flag: '🇪🇸', hasApprovedPack: false },
  { code: 'IT', name: 'Italy', language: 'Italian', flag: '🇮🇹', hasApprovedPack: true },
  { code: 'NL', name: 'Netherlands', language: 'Dutch', flag: '🇳🇱', hasApprovedPack: false },
  { code: 'PL', name: 'Poland', language: 'Polish', flag: '🇵🇱', hasApprovedPack: true },
];

const ELEMENTS = [
  { id: 'subtitles', name: 'Subtitles / Captions', icon: MessageSquare, description: 'AI-translated from master script', method: 'AI translation + human QA' },
  { id: 'endcard', name: 'End Card', icon: Image, description: 'Template: Finish_Endcard_2024_v2', method: 'Text swap in AE template' },
  { id: 'pack', name: 'Product Pack', icon: Package, description: 'Swap to market-specific approved pack', method: 'Asset library swap' },
  { id: 'supers', name: 'On-screen Supers', icon: Type, description: 'CTA and promo text overlays', method: 'Template text replacement' },
];

const SAMPLE_SUBTITLES = {
  EN: [
    { tc: '00:02', text: 'Discover the power of clean.' },
    { tc: '00:05', text: 'Finish Quantum cuts through grease.' },
    { tc: '00:09', text: 'For a brilliant shine, every time.' },
    { tc: '00:14', text: 'Finish. The ultimate clean.' },
  ],
  DE: [
    { tc: '00:02', text: 'Entdecken Sie die Kraft der Sauberkeit.' },
    { tc: '00:05', text: 'Finish Quantum löst Fett mühelos.' },
    { tc: '00:09', text: 'Für brillanten Glanz, jedes Mal.' },
    { tc: '00:14', text: 'Finish. Die ultimative Reinigung.' },
  ],
  FR: [
    { tc: '00:02', text: 'Découvrez la puissance du propre.' },
    { tc: '00:05', text: 'Finish Quantum élimine la graisse.' },
    { tc: '00:09', text: 'Pour une brillance parfaite, à chaque fois.' },
    { tc: '00:14', text: 'Finish. Le nettoyage ultime.' },
  ],
  ES: [
    { tc: '00:02', text: 'Descubre el poder de la limpieza.' },
    { tc: '00:05', text: 'Finish Quantum elimina la grasa.' },
    { tc: '00:09', text: 'Para un brillo perfecto, siempre.' },
    { tc: '00:14', text: 'Finish. La limpieza definitiva.' },
  ],
};

const PACK_DATA = {
  EN: { count: '36', unit: 'ALL IN 1 TABS', cta: 'FAST DISSOLVING', scent: 'LEMON SPARKLE' },
  DE: { count: '33', unit: 'CAPS ALL IN 1', cta: 'SCHNELL LÖSEND', scent: 'FRISCHER DUFT' },
  FR: { count: '33', unit: 'CAPSULES TOUT EN 1', cta: 'DISSOLUTION RAPIDE', scent: 'PARFUM FRAIS' },
  ES: { count: '33', unit: 'CÁPSULAS TODO EN 1', cta: 'DISOLUCIÓN RÁPIDA', scent: 'AROMA FRESCO' },
};

const ENDCARD_DATA = {
  EN: { headline: 'Brilliant shine.', cta: 'Shop now', legal: '© 2024 Henkel. All rights reserved.', url: 'finish.co.uk' },
  DE: { headline: 'Strahlender Glanz.', cta: 'Jetzt kaufen', legal: '© 2024 Henkel. Alle Rechte vorbehalten.', url: 'finish.de' },
  FR: { headline: 'Brillance éclatante.', cta: 'Acheter maintenant', legal: '© 2024 Henkel. Tous droits réservés.', url: 'finish.fr' },
  ES: { headline: 'Brillo radiante.', cta: 'Comprar ahora', legal: '© 2024 Henkel. Todos los derechos reservados.', url: 'finish.es' },
};

// Visual Components for Pack and End Card
const PackShotVisual = ({ market, isOriginal = false }) => {
  const data = isOriginal ? PACK_DATA.EN : (PACK_DATA[market] || PACK_DATA.EN);
  const marketInfo = MARKETS.find(m => m.code === market);

  return (
    <div className="relative w-full aspect-square max-w-[200px] mx-auto">
      {/* Pack shape */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500 to-blue-700 rounded-lg shadow-xl overflow-hidden">
        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          <div className="bg-yellow-400 text-blue-900 text-[8px] font-bold px-1.5 py-0.5 rounded">
            #1 BRAND
          </div>
          <div className="flex gap-1">
            <div className="bg-white/20 text-white text-[6px] px-1 py-0.5 rounded">NO PRE-RINSE</div>
          </div>
        </div>

        {/* Brand */}
        <div className="absolute top-8 left-0 right-0 text-center">
          <div className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: 'Arial Black' }}>
            finish
          </div>
          <div className="bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 mx-auto w-fit">
            POWERBALL
          </div>
          <div className="text-white font-bold text-sm mt-0.5">QUANTUM</div>
        </div>

        {/* Count badge */}
        <div className="absolute left-3 top-[45%] bg-blue-900/80 rounded px-2 py-1 text-center">
          <div className="text-white font-bold text-xl leading-none">{data.count}</div>
          <div className="text-white text-[6px] leading-tight">{data.unit}</div>
        </div>

        {/* Product visual placeholder */}
        <div className="absolute right-2 top-[40%] w-16 h-16">
          <div className="w-full h-full bg-white/30 rounded-lg flex items-center justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full" />
          </div>
        </div>

        {/* CTA */}
        <div className="absolute right-3 bottom-16 bg-red-600 text-white text-[8px] font-bold px-2 py-1 rounded transform rotate-[-5deg]">
          {data.cta}
        </div>

        {/* Scent */}
        <div className="absolute left-3 bottom-12 text-yellow-300 text-[7px] font-medium">
          {data.scent}
        </div>

        {/* Bottom legal */}
        <div className="absolute bottom-2 left-2 right-2 text-white/60 text-[5px] text-center">
          RECYCLABLE PACKAGING*
        </div>
      </div>

      {/* Market indicator */}
      {!isOriginal && (
        <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
          {marketInfo?.flag}
        </div>
      )}
    </div>
  );
};

const EndCardVisual = ({ market, isOriginal = false }) => {
  const data = isOriginal ? ENDCARD_DATA.EN : (ENDCARD_DATA[market] || ENDCARD_DATA.EN);

  return (
    <div className="relative w-full aspect-video bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 rounded-lg overflow-hidden shadow-xl">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-4">
        {/* Top - Brand */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white font-bold text-lg" style={{ fontFamily: 'Arial Black' }}>
              finish
            </div>
            <div className="bg-red-600 text-white text-[6px] font-bold px-1.5 py-0.5 w-fit">
              POWERBALL
            </div>
          </div>
          <div className="text-white/40 text-[8px]">{data.url}</div>
        </div>

        {/* Middle - Headline */}
        <div className="text-center">
          <h2 className="text-white font-bold text-xl mb-2">{data.headline}</h2>
          <button className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors">
            {data.cta}
          </button>
        </div>

        {/* Bottom - Legal */}
        <div className="text-white/40 text-[7px] text-center">
          {data.legal}
        </div>
      </div>

      {/* Localized badge */}
      {!isOriginal && (
        <div className="absolute top-2 right-2 bg-purple-500/80 text-white text-[10px] font-medium px-2 py-1 rounded">
          Localized
        </div>
      )}
    </div>
  );
};

// Frame preview component for timeline
const FramePreview = ({ type, market, timecode, label, isOriginal = false }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-400 font-mono text-xs">{timecode}</span>
        <span className="text-gray-500 text-xs">•</span>
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-gray-500 text-[10px] mb-1 text-center">MASTER</div>
          {type === 'pack' ? (
            <div className="transform scale-75 origin-top">
              <PackShotVisual market="EN" isOriginal={true} />
            </div>
          ) : (
            <EndCardVisual market="EN" isOriginal={true} />
          )}
        </div>
        <div>
          <div className="text-purple-400 text-[10px] mb-1 text-center">VARIANT</div>
          {type === 'pack' ? (
            <div className="transform scale-75 origin-top">
              <PackShotVisual market={market} />
            </div>
          ) : (
            <EndCardVisual market={market} />
          )}
        </div>
      </div>
    </div>
  );
};

export default function HenkelLocaliser() {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState(['DE', 'FR', 'ES']);
  const [selectedElements, setSelectedElements] = useState(['subtitles', 'endcard', 'pack']);
  const [reviewMarket, setReviewMarket] = useState('DE');
  const [reviewTab, setReviewTab] = useState('all'); // 'all', 'subtitles', 'pack', 'endcard'
  const [renderProgress, setRenderProgress] = useState({});
  const [expandedPreview, setExpandedPreview] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState(null);
  // API key - leave empty, users enter via UI or set OPENAI_API_KEY env var when deployed
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const fileInputRef = React.useRef(null);

  const steps = [
    { id: 'upload', name: 'Upload Master', icon: Upload },
    { id: 'markets', name: 'Select Markets', icon: Globe },
    { id: 'elements', name: 'Localise Elements', icon: Layers },
    { id: 'review', name: 'Review Variants', icon: Eye },
    { id: 'export', name: 'Export & Deliver', icon: Download },
  ];

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' bytes';
  };

  const processVideoFile = async (file) => {
    setIsProcessing(true);

    // Create object URL for video preview
    const videoUrl = URL.createObjectURL(file);
    setVideoPreview(videoUrl);

    // Use a promise-based approach for more reliable metadata extraction
    const getVideoMetadata = () => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const timeoutId = setTimeout(() => {
          // Fallback if metadata doesn't load in 5 seconds
          resolve({
            duration: null,
            width: null,
            height: null
          });
        }, 5000);

        video.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight
          });
        };

        video.onerror = () => {
          clearTimeout(timeoutId);
          resolve({
            duration: null,
            width: null,
            height: null
          });
        };

        video.src = videoUrl;
        video.load();
      });
    };

    const metadata = await getVideoMetadata();

    setUploadedFile({
      name: file.name,
      duration: metadata.duration ? formatDuration(metadata.duration) : 'Processing...',
      durationSeconds: metadata.duration,
      resolution: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : 'Processing...',
      width: metadata.width,
      height: metadata.height,
      fps: '25', // Browser can't reliably detect this
      language: 'English (assumed)',
      size: formatFileSize(file.size),
      type: file.type || 'video/mp4',
      file: file,
      url: videoUrl
    });
    setIsProcessing(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processVideoFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processVideoFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const clearUpload = () => {
    if (uploadedFile?.url) {
      URL.revokeObjectURL(uploadedFile.url);
    }
    setUploadedFile(null);
    setVideoPreview(null);
    setTranscript(null);
    setTranscriptError(null);
    setVideoLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const transcribeWithWhisper = async () => {
    if (!uploadedFile?.file || !apiKey) {
      setShowApiKeyInput(true);
      return;
    }

    setIsTranscribing(true);
    setTranscriptError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      // Try direct request first, then CORS proxy fallback
      let response;
      let usedProxy = false;

      try {
        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });
      } catch (directError) {
        // If direct fails (CORS), try with proxy
        console.log('Direct request failed, trying CORS proxy...');
        usedProxy = true;
        
        // Using corsproxy.io as fallback
        response = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://api.openai.com/v1/audio/transcriptions'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Transcription failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Convert Whisper segments to our subtitle format
      const segments = data.segments?.map(seg => ({
        tc: formatDuration(seg.start),
        text: seg.text.trim(),
        start: seg.start,
        end: seg.end
      })) || [{ tc: '00:00', text: data.text, start: 0, end: 0 }];

      setTranscript({
        language: data.language || 'en',
        segments: segments,
        fullText: data.text,
        usedProxy: usedProxy
      });

    } catch (error) {
      console.error('Transcription error:', error);
      setTranscriptError(
        error.message === 'Failed to fetch' 
          ? 'Network blocked in sandbox. Click "Use Demo Data" for now, or deploy to Vercel for full AI transcription.'
          : error.message
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const useDemoTranscript = () => {
    setTranscript({
      language: 'en',
      segments: SAMPLE_SUBTITLES.EN.map((sub, i) => ({
        ...sub,
        start: parseInt(sub.tc.split(':')[1]),
        end: parseInt(sub.tc.split(':')[1]) + 3
      })),
      fullText: SAMPLE_SUBTITLES.EN.map(s => s.text).join(' '),
      isDemo: true
    });
  };

  const toggleMarket = (code) => {
    setSelectedMarkets(prev =>
      prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code]
    );
  };

  const toggleElement = (id) => {
    setSelectedElements(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const startRender = () => {
    selectedMarkets.forEach((market, index) => {
      setTimeout(() => {
        setRenderProgress(prev => ({ ...prev, [market]: 0 }));
        const interval = setInterval(() => {
          setRenderProgress(prev => {
            const current = prev[market] || 0;
            if (current >= 100) {
              clearInterval(interval);
              return prev;
            }
            return { ...prev, [market]: current + 10 };
          });
        }, 300);
      }, index * 500);
    });
  };

  // Step Components
  const UploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">Upload Master Video</h2>
        <p className="text-gray-400">Upload your hero video to begin localization</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mov,.mp4,.mxf,.avi,.webm"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!uploadedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-600 hover:border-purple-500 hover:bg-purple-500/5'
            }`}
        >
          {isProcessing ? (
            <>
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 mb-2">Processing video...</p>
              <p className="text-gray-500 text-sm">Extracting metadata</p>
            </>
          ) : (
            <>
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
              <p className="text-gray-400 mb-2">
                {isDragging ? 'Drop your video here' : 'Drag and drop your video here'}
              </p>
              <p className="text-gray-500 text-sm">or click to browse</p>
              <p className="text-gray-600 text-xs mt-4">Supports .mov, .mp4, .mxf, .avi, .webm</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-start gap-4">
            {/* Video thumbnail - with fallback */}
            <div className="w-48 h-28 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden relative flex-shrink-0">
              {!videoLoadError && uploadedFile.url ? (
                <video
                  src={uploadedFile.url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedData={(e) => e.target.currentTime = 0.1}
                  onError={() => setVideoLoadError(true)}
                />
              ) : (
                <div className="text-center">
                  <FileVideo className="w-10 h-10 text-purple-400 mx-auto mb-1" />
                  <span className="text-gray-500 text-xs">Preview unavailable</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-white font-medium truncate">{uploadedFile.name}</h3>
                <button
                  onClick={clearUpload}
                  className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-gray-300">{uploadedFile.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolution:</span>
                  <span className="text-gray-300">{uploadedFile.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">File Size:</span>
                  <span className="text-gray-300">{uploadedFile.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Format:</span>
                  <span className="text-gray-300">{uploadedFile.type || 'video/mp4'}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full text-center">Uploaded</span>
              {transcript && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full text-center">Transcribed</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transcription Section */}
      {uploadedFile && (
        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Mic className="w-4 h-4 text-purple-400" />
              Transcript
            </h4>
            {!transcript && (
              <div className="flex gap-2">
                <button
                  onClick={useDemoTranscript}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Use Demo Data
                </button>
                <button
                  onClick={() => apiKey ? transcribeWithWhisper() : setShowApiKeyInput(true)}
                  disabled={isTranscribing}
                  className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Transcribe with AI
                    </>
                  )}
                </button>
              </div>
            )}
            {transcript && (
              <button
                onClick={() => { setTranscript(null); setShowApiKeyInput(false); }}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* API Key Input */}
          {showApiKeyInput && !apiKey && !transcript && (
            <div className="mb-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-gray-400 text-sm mb-3">
                Enter your OpenAI API key to transcribe with Whisper (~$0.006/min)
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={transcribeWithWhisper}
                  disabled={!apiKey || isTranscribing}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Transcribe
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">platform.openai.com/api-keys</a>
              </p>
            </div>
          )}

          {/* Error Message */}
          {transcriptError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {transcriptError}
              </p>
            </div>
          )}

          {/* Transcript Display */}
          {transcript ? (
            <div>
              {transcript.isDemo && (
                <p className="text-amber-400/80 text-xs mb-3 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Demo transcript — use "Transcribe with AI" for real results
                </p>
              )}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {transcript.segments.map((seg, i) => (
                  <div key={i} className="flex gap-4 text-sm">
                    <span className="text-purple-400 font-mono w-16 flex-shrink-0">{seg.tc}</span>
                    <span className="text-gray-300">{seg.text}</span>
                  </div>
                ))}
              </div>
              {transcript.language && !transcript.isDemo && (
                <p className="text-gray-500 text-xs mt-3">
                  Detected language: {transcript.language.toUpperCase()}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transcript yet</p>
              <p className="text-xs mt-1">Click "Transcribe with AI" or use demo data</p>
            </div>
          )}
        </div>
      )}

      {/* Video Preview Player - with fallback */}
      {uploadedFile && uploadedFile.url && !videoLoadError && (
        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-400" />
            Preview
          </h4>
          <video
            src={uploadedFile.url}
            controls
            className="w-full rounded-lg max-h-[300px] bg-black"
            onError={() => setVideoLoadError(true)}
            onLoadedMetadata={(e) => {
              const video = e.target;
              if (uploadedFile.duration === 'Processing...' || uploadedFile.resolution === 'Processing...') {
                setUploadedFile(prev => ({
                  ...prev,
                  duration: formatDuration(video.duration),
                  durationSeconds: video.duration,
                  resolution: `${video.videoWidth}x${video.videoHeight}`,
                  width: video.videoWidth,
                  height: video.videoHeight
                }));
              }
            }}
          />
        </div>
      )}

      {/* Sandbox notice */}
      {uploadedFile && videoLoadError && (
        <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
          <p className="text-amber-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Video preview unavailable in this environment. When deployed, the full video player will work.
          </p>
        </div>
      )}
    </div>
  );

  const MarketsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">Select Target Markets</h2>
        <p className="text-gray-400">Choose which markets to create variants for</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {MARKETS.map(market => (
          <div
            key={market.code}
            onClick={() => toggleMarket(market.code)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedMarkets.includes(market.code)
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 hover:border-gray-600'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{market.flag}</span>
              {selectedMarkets.includes(market.code) && (
                <Check className="w-5 h-5 text-purple-400" />
              )}
            </div>
            <h3 className="text-white font-medium">{market.name}</h3>
            <p className="text-gray-500 text-sm">{market.language}</p>
            {!market.hasApprovedPack && (
              <div className="flex items-center gap-1 mt-2 text-amber-400 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>Pack pending approval</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Selected markets:</span>
          <span className="text-white font-medium">{selectedMarkets.length} of {MARKETS.length}</span>
        </div>
      </div>
    </div>
  );

  const ElementsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">Choose Localization Elements</h2>
        <p className="text-gray-400">Select which elements to localize in your variants</p>
      </div>

      <div className="space-y-4">
        {ELEMENTS.map(element => {
          const Icon = element.icon;
          const isSelected = selectedElements.includes(element.id);
          const hasMissingAssets = element.id === 'pack' && selectedMarkets.some(m =>
            !MARKETS.find(market => market.code === m)?.hasApprovedPack
          );

          return (
            <div
              key={element.id}
              onClick={() => toggleElement(element.id)}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 hover:border-gray-600'
                }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${isSelected ? 'bg-purple-500/20' : 'bg-gray-800'}`}>
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-purple-400' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">{element.name}</h3>
                    {isSelected && <Check className="w-5 h-5 text-purple-400" />}
                  </div>
                  <p className="text-gray-500 text-sm mt-1">{element.description}</p>
                  <p className="text-gray-600 text-xs mt-2">Method: {element.method}</p>
                </div>
              </div>
              {isSelected && hasMissingAssets && (
                <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Some markets missing approved pack artwork</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const ReviewStep = () => {
    const market = MARKETS.find(m => m.code === reviewMarket);
    // Use real transcript if available, otherwise fall back to sample
    const masterSubtitles = transcript?.segments || SAMPLE_SUBTITLES.EN;
    const localizedSubtitles = SAMPLE_SUBTITLES[reviewMarket] || SAMPLE_SUBTITLES.EN;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Review Variants</h2>
          <p className="text-gray-400">Compare master with localized variants</p>
        </div>

        {/* Market selector */}
        <div className="flex gap-2 justify-center">
          {selectedMarkets.map(code => {
            const m = MARKETS.find(market => market.code === code);
            return (
              <button
                key={code}
                onClick={() => setReviewMarket(code)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${reviewMarket === code
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
              >
                <span>{m?.flag}</span>
                <span>{m?.name}</span>
              </button>
            );
          })}
        </div>

        {/* Element tabs */}
        <div className="flex gap-2 justify-center border-b border-gray-800 pb-4">
          {[
            { id: 'all', label: 'All Changes' },
            { id: 'subtitles', label: 'Subtitles' },
            { id: 'pack', label: 'Pack Shot' },
            { id: 'endcard', label: 'End Card' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setReviewTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${reviewTab === tab.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content based on tab */}
        {(reviewTab === 'all' || reviewTab === 'subtitles') && selectedElements.includes('subtitles') && (
          <div className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                Subtitle Changes
              </h4>
              <span className="text-gray-500 text-sm">{masterSubtitles.length} lines</span>
            </div>
            <div className="space-y-3">
              {masterSubtitles.map((sub, i) => (
                <div key={i} className="grid grid-cols-2 gap-4 p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Original (EN)</div>
                    <div className="text-gray-400 text-sm">{sub.text}</div>
                  </div>
                  <div>
                    <div className="text-purple-400 text-xs mb-1">Translated ({reviewMarket})</div>
                    <div className="text-white text-sm">
                      {localizedSubtitles[i]?.text || '(Translation pending)'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(reviewTab === 'all' || reviewTab === 'pack') && selectedElements.includes('pack') && (
          <div className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                Pack Shot Swap
              </h4>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${market?.hasApprovedPack ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {market?.hasApprovedPack ? 'Approved Asset' : 'Pending Approval'}
                </span>
                <button
                  onClick={() => setExpandedPreview('pack')}
                  className="p-1 hover:bg-gray-700 rounded"
                >
                  <Maximize2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-gray-500 text-xs mb-3 text-center">MASTER (UK)</div>
                <PackShotVisual market="EN" isOriginal={true} />
                <div className="text-center mt-2">
                  <span className="text-gray-500 text-xs">36 count • English labels</span>
                </div>
              </div>
              <div>
                <div className="text-purple-400 text-xs mb-3 text-center">VARIANT ({market?.flag} {market?.code})</div>
                <PackShotVisual market={reviewMarket} />
                <div className="text-center mt-2">
                  <span className="text-purple-400 text-xs">{PACK_DATA[reviewMarket]?.count || '33'} count • {market?.language} labels</span>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
              <div className="text-gray-500 text-xs mb-2">Changes detected:</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">Count: 36 → {PACK_DATA[reviewMarket]?.count || '33'}</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">Unit label localized</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">CTA translated</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">Scent text updated</span>
              </div>
            </div>
          </div>
        )}

        {(reviewTab === 'all' || reviewTab === 'endcard') && selectedElements.includes('endcard') && (
          <div className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Image className="w-4 h-4 text-purple-400" />
                End Card Localization
              </h4>
              <button
                onClick={() => setExpandedPreview('endcard')}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <Maximize2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-gray-500 text-xs mb-2 text-center">MASTER (EN)</div>
                <EndCardVisual market="EN" isOriginal={true} />
              </div>
              <div>
                <div className="text-purple-400 text-xs mb-2 text-center">VARIANT ({market?.flag} {market?.code})</div>
                <EndCardVisual market={reviewMarket} />
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
              <div className="text-gray-500 text-xs mb-2">Text changes:</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Headline:</span>
                  <div className="text-purple-300 mt-1">"{ENDCARD_DATA[reviewMarket]?.headline}"</div>
                </div>
                <div>
                  <span className="text-gray-500">CTA:</span>
                  <div className="text-purple-300 mt-1">"{ENDCARD_DATA[reviewMarket]?.cta}"</div>
                </div>
                <div>
                  <span className="text-gray-500">URL:</span>
                  <div className="text-purple-300 mt-1">{ENDCARD_DATA[reviewMarket]?.url}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval actions */}
        <div className="flex justify-center gap-4">
          <button className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Request Amends
          </button>
          <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
            <Check className="w-4 h-4" />
            Approve {market?.name} Variant
          </button>
        </div>
      </div>
    );
  };

  const ExportStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">Export & Deliver</h2>
        <p className="text-gray-400">Render final variants and deliver to destinations</p>
      </div>

      {Object.keys(renderProgress).length === 0 ? (
        <div className="text-center py-8">
          <button
            onClick={startRender}
            className="px-8 py-4 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
          >
            Start Rendering All Variants
          </button>
          <p className="text-gray-500 text-sm mt-4">
            {selectedMarkets.length} variants × {selectedElements.length} elements
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedMarkets.map(code => {
            const market = MARKETS.find(m => m.code === code);
            const progress = renderProgress[code] || 0;
            const isComplete = progress >= 100;

            return (
              <div key={code} className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{market?.flag}</span>
                    <span className="text-white font-medium">{market?.name}</span>
                  </div>
                  {isComplete ? (
                    <span className="flex items-center gap-2 text-green-400 text-sm">
                      <Check className="w-4 h-4" />
                      Complete
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">{progress}%</span>
                  )}
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {isComplete && (
                  <div className="flex gap-3 mt-4">
                    <button className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors">
                      Send to Frame.io
                    </button>
                    <button className="flex-1 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 transition-colors">
                      Download .zip
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {Object.values(renderProgress).every(p => p >= 100) && Object.keys(renderProgress).length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
          <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-white font-medium text-lg">All Variants Complete!</h3>
          <p className="text-gray-400 text-sm mt-2">
            {selectedMarkets.length} market variants ready for delivery
          </p>
          <button className="mt-4 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
            Download All as Package
          </button>
        </div>
      )}
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <UploadStep />;
      case 1: return <MarketsStep />;
      case 2: return <ElementsStep />;
      case 3: return <ReviewStep />;
      case 4: return <ExportStep />;
      default: return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return uploadedFile !== null && transcript !== null;
      case 1: return selectedMarkets.length > 0;
      case 2: return selectedElements.length > 0;
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  };

  // Expanded preview modal
  const ExpandedPreviewModal = () => {
    if (!expandedPreview) return null;

    const market = MARKETS.find(m => m.code === reviewMarket);

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setExpandedPreview(null)}>
        <div className="bg-gray-900 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold text-lg">
              {expandedPreview === 'pack' ? 'Pack Shot Comparison' : 'End Card Comparison'}
            </h3>
            <button onClick={() => setExpandedPreview(null)} className="p-2 hover:bg-gray-800 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-gray-500 text-sm mb-4 text-center">MASTER (UK English)</div>
              {expandedPreview === 'pack' ? (
                <div className="flex justify-center">
                  <PackShotVisual market="EN" isOriginal={true} />
                </div>
              ) : (
                <EndCardVisual market="EN" isOriginal={true} />
              )}
            </div>
            <div>
              <div className="text-purple-400 text-sm mb-4 text-center">VARIANT ({market?.flag} {market?.language})</div>
              {expandedPreview === 'pack' ? (
                <div className="flex justify-center">
                  <PackShotVisual market={reviewMarket} />
                </div>
              ) : (
                <EndCardVisual market={reviewMarket} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg" />
            <span className="font-semibold text-lg">AI Production Localiser</span>
          </div>
          <span className="text-gray-500 text-sm">Henkel × Accenture Song</span>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isComplete ? 'bg-purple-500' : isActive ? 'bg-purple-500/20 border-2 border-purple-500' : 'bg-gray-800'
                      }`}>
                      {isComplete ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : 'text-gray-500'}`} />
                      )}
                    </div>
                    <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-white' : 'text-gray-500'}`}>
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${index < currentStep ? 'bg-purple-500' : 'bg-gray-800'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 py-8 pb-24">
        <div className="max-w-4xl mx-auto">
          {renderStep()}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-950 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 0
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${index === currentStep ? 'bg-purple-500' : index < currentStep ? 'bg-purple-500/50' : 'bg-gray-700'
                  }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
            disabled={!canProceed() || currentStep === steps.length - 1}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${!canProceed() || currentStep === steps.length - 1
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
          >
            {currentStep === steps.length - 1 ? 'Complete' : 'Continue'}
            {currentStep < steps.length - 1 && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </footer>

      {/* Expanded Preview Modal */}
      <ExpandedPreviewModal />
    </div>
  );
}
