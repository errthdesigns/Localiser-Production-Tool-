# AI Video Localiser

A professional AI-powered video localization tool for Accenture Song / Henkel featuring:
- **Gemini AI** for comprehensive video analysis and context-aware translation
- **ElevenLabs** for natural multilingual voice generation
- **Smart workflow** with quality verification and timing preservation

## 🎯 New Workflow

1. **Upload Video** → System extracts metadata
2. **Gemini Analyzes** → Scans video for visual context, scenes, and transcription
3. **Smart Translation** → Context-aware translation with timing preservation
4. **Voice Generation** → ElevenLabs creates natural-sounding dubbed audio
5. **Quality Check** → AI verifies accuracy, fluency, and cultural appropriateness
6. **Download** → Get translated audio ready for video assembly

## 🏗️ Architecture

### Service Layer (`/lib/services/`)
- **`gemini.ts`** - Video analysis, transcription, visual context extraction
- **`translation.ts`** - Context-aware translation with Gemini
- **`elevenlabs.ts`** - Voice generation with timing adjustments

### Type System (`/lib/types/`)
- Comprehensive TypeScript interfaces
- Type-safe API contracts
- Shared types across frontend and backend

### API Routes (`/app/api/`)
- **`/analyze-video`** - Gemini video analysis endpoint
- **`/process-localization`** - Main orchestration endpoint
- **`/text-to-speech`** - ElevenLabs voice generation
- **`/transcribe`** - Legacy OpenAI Whisper support

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- ElevenLabs API key ([Get one here](https://elevenlabs.io/app/settings/api-keys))
- (Optional) OpenAI API key for fallback transcription

### Installation

```bash
# Clone the repository
git clone https://github.com/errthdesigns/Localiser-Production-Tool-.git
cd Localiser-Production-Tool-

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys
```

### Environment Variables

```env
# Required
GEMINI_API_KEY=your-gemini-api-key-here
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# Optional (for fallback transcription)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

## 📖 Usage

### Quick Start
1. Upload your master video (MP4, MOV, WebM, AVI)
2. Select target language
3. Click "Start Localization"
4. Review AI quality report
5. Download translated audio
6. Combine with video using your preferred editor

### Advanced: Using the Service Layer

```typescript
import { GeminiService } from '@/lib/services/gemini';
import { TranslationService } from '@/lib/services/translation';
import { ElevenLabsService } from '@/lib/services/elevenlabs';

// Analyze video
const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
const analysis = await gemini.analyzeVideo(videoFile);

// Translate with context
const translator = new TranslationService(process.env.GEMINI_API_KEY!);
const translation = await translator.translate(
  {
    text: analysis.transcript.map(s => s.text).join(' '),
    sourceLanguage: 'English',
    targetLanguage: 'German',
    preserveTiming: true
  },
  analysis
);

// Generate voice
const voice = new ElevenLabsService(process.env.ELEVENLABS_API_KEY!);
const audio = await voice.generateSpeech({
  text: translation.translatedText,
  voiceId: 'your-voice-id',
  language: 'de'
});
```

## 🎨 Supported Languages

- 🇩🇪 German
- 🇫🇷 French
- 🇪🇸 Spanish
- 🇮🇹 Italian
- 🇳🇱 Dutch
- 🇵🇱 Polish
- 🇵🇹 Portuguese
- 🇯🇵 Japanese

## 🔧 Video Assembly

After downloading translated audio, combine it with your video:

### Option 1: Video Editors
- **Adobe Premiere Pro** - Replace audio track
- **Final Cut Pro** - Swap audio in timeline
- **DaVinci Resolve** - Audio track replacement
- **iMovie** - Detach and replace audio

### Option 2: FFmpeg CLI
```bash
ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output.mp4
```

### Option 3: Cloud Services
- **Cloudinary** - Video transformation API
- **Shotstack** - Video editing API
- **Mux** - Video infrastructure

## 📊 Features

### 🤖 Gemini AI Video Analysis
- Scene detection with timestamps
- Visual context extraction (mood, setting, objects)
- Speaker detection
- Audio feature analysis
- Intelligent transcription

### 🌍 Context-Aware Translation
- Preserves timing for lip-sync
- Considers visual context
- Cultural appropriateness
- Tone matching
- Length optimization

### 🎙️ ElevenLabs Voice Generation
- Natural multilingual voices
- Timing-adjusted speech
- Multiple speaker support
- Emotion preservation
- High-quality audio output

### ✅ Quality Verification
- **Accuracy** - Meaning preservation
- **Fluency** - Natural language flow
- **Cultural Fit** - Appropriate for target market
- **Timing** - Suitable for dubbing
- Auto-approval at 80%+ overall score

## 💰 Cost Estimates

Per 60-second video:
- Gemini Video Analysis: ~$0.05
- Gemini Translation: ~$0.01
- ElevenLabs Voice: ~$0.30
- Quality Verification: ~$0.01
- **Total: ~$0.37/minute**

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Services**:
  - Google Gemini 2.0 Flash (video analysis, translation)
  - ElevenLabs Multilingual V2 (voice generation)
  - OpenAI Whisper (fallback transcription)

## 📦 Project Structure

```
/lib
  /services       # Service layer for AI integrations
  /types          # TypeScript type definitions
  /utils          # Utility functions
/app
  /api            # Next.js API routes
    /analyze-video
    /process-localization
    /text-to-speech
    /transcribe
  /components     # React components (if needed)
  page.tsx        # Main UI
  layout.tsx      # App layout
```

## 🚀 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/errthdesigns/Localiser-Production-Tool-)

1. Click deploy button
2. Add environment variables:
   - `GEMINI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `OPENAI_API_KEY` (optional)
3. Deploy!

## 📝 License

MIT

## 👏 Credits

Built for **Henkel × Accenture Song**
Powered by Google Gemini, ElevenLabs, and OpenAI
