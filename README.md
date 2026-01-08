# AI Video Localiser with Automatic Lip-Sync

Professional AI-powered video localization tool for Accenture Song / Henkel featuring:
- **Gemini AI** for video analysis and context-aware translation
- **ElevenLabs** for natural multilingual voice generation
- **HeyGen** for automatic AI lip-sync video generation
- End-to-end workflow with zero manual editing required

## 🎯 Complete Workflow

1. **Upload Video** → Extract metadata and prepare for analysis
2. **Gemini Analyzes** → Comprehensive video scanning:
   - Visual context (scenes, objects, mood, setting)
   - Full transcription with speaker detection
   - Audio features and language detection
3. **Context-Aware Translation** → Gemini translates with:
   - Visual scene context
   - Cultural appropriateness
   - Timing preservation for lip-sync
   - Mood and tone matching
4. **Voice Generation** → ElevenLabs creates:
   - Natural-sounding multilingual voice
   - Timing-adjusted speech
   - Emotion preservation
5. **Automatic Lip-Sync** → HeyGen generates:
   - AI-powered lip-synced video
   - Perfect mouth movements
   - Natural facial expressions
6. **Quality Verification** → AI assesses:
   - Translation accuracy
   - Cultural appropriateness
   - Timing suitability
   - Overall quality score
7. **Download** → Complete localized video with lip-sync!

## ⚡ Key Advantage

**Zero manual editing required!** The entire process is automated from upload to lip-synced video download.

## 🏗️ Architecture

### Service Layer (`/lib/services/`)
- **`gemini.ts`** - Video analysis, transcription, visual context
- **`translation.ts`** - Context-aware translation with Gemini
- **`elevenlabs.ts`** - Natural voice generation with timing
- **`heygen.ts`** - AI lip-sync video generation

### API Routes (`/app/api/`)
- **`/analyze-video`** - Gemini video analysis
- **`/process-localization`** - Full workflow orchestration
- **`/text-to-speech`** - ElevenLabs voice generation
- **`/generate-video`** - HeyGen lip-sync generation
- **`/transcribe`** - Legacy OpenAI Whisper support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- **Gemini API key** ([Get here](https://aistudio.google.com/app/apikey))
- **ElevenLabs API key** ([Get here](https://elevenlabs.io/app/settings/api-keys))
- **HeyGen API key** ([Get here](https://app.heygen.com/settings/api))

### Installation

```bash
git clone https://github.com/errthdesigns/Localiser-Production-Tool-.git
cd Localiser-Production-Tool-

npm install

cp .env.example .env.local
# Edit .env.local and add your API keys
```

### Environment Variables

```env
GEMINI_API_KEY=your-gemini-api-key-here        # Required
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here  # Required
HEYGEN_API_KEY=your-heygen-api-key-here        # Required
OPENAI_API_KEY=sk-...                          # Optional
```

### Run

```bash
npm run dev
# Open http://localhost:3000
```

## 📖 Usage

### Simple Workflow
1. Upload your master video (MP4, MOV, WebM)
2. Select target language
3. Click "Start Localization"
4. Wait for processing (~2-5 minutes)
5. Review quality report
6. Download complete lip-synced video!

### Advanced: Programmatic Usage

```typescript
import { GeminiService } from '@/lib/services/gemini';
import { TranslationService } from '@/lib/services/translation';
import { ElevenLabsService } from '@/lib/services/elevenlabs';
import { HeyGenService } from '@/lib/services/heygen';

// Analyze video
const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
const analysis = await gemini.analyzeVideo(videoFile);

// Translate with context
const translator = new TranslationService(process.env.GEMINI_API_KEY!);
const translation = await translator.translate({
  text: analysis.transcript.map(s => s.text).join(' '),
  sourceLanguage: analysis.audioFeatures.language,
  targetLanguage: 'German',
  preserveTiming: true
}, analysis);

// Generate voice
const voice = new ElevenLabsService(process.env.ELEVENLABS_API_KEY!);
const audio = await voice.generateSpeech({
  text: translation.translatedText,
  voiceId: 'your-voice-id',
  language: 'de'
});

// Create lip-synced video
const heygen = new HeyGenService(process.env.HEYGEN_API_KEY!);
const video = await heygen.generateLipSyncVideo(videoFile, audio.audioBlob);
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
- And more (ElevenLabs + HeyGen support 40+ languages)

## 🔥 Features

### 🤖 Gemini AI Video Analysis
- Full scene detection with timestamps
- Visual context extraction (mood, setting, objects, colors)
- Speaker detection and tracking
- Audio feature analysis
- Intelligent transcription

### 🌍 Context-Aware Translation
- Visual scene context considered
- Timing preservation for perfect lip-sync
- Cultural appropriateness checks
- Tone and emotion matching
- Length optimization

### 🎙️ ElevenLabs Voice Generation
- Natural multilingual voices
- Timing-adjusted speech rates
- Multiple speaker support
- Emotion and tone preservation
- Professional audio quality

### 🎬 HeyGen AI Lip-Sync
- **Automatic lip-sync** - No manual editing needed!
- Natural mouth movements
- Facial expression preservation
- High-quality video output
- Fast processing (2-5 minutes)

### ✅ Quality Verification
- **Accuracy** (0-100) - Translation correctness
- **Fluency** (0-100) - Natural language flow
- **Cultural Fit** (0-100) - Market appropriateness
- **Timing** (0-100) - Lip-sync suitability
- Auto-approval at 80%+ score

## 💰 Cost Breakdown

Per 60-second video:
- Gemini Video Analysis: ~$0.05
- Gemini Translation: ~$0.01
- ElevenLabs Voice: ~$0.30
- HeyGen Lip-Sync: ~$0.50
- Quality Verification: ~$0.01
- **Total: ~$0.87/minute**

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Services**:
  - Google Gemini 2.0 Flash (video analysis, translation)
  - ElevenLabs Multilingual V2 (voice generation)
  - HeyGen API (AI lip-sync video generation)

## 📦 Project Structure

```
/lib
  /services       # AI service integrations
    gemini.ts     # Video analysis & translation
    translation.ts # Context-aware translation
    elevenlabs.ts # Voice generation
    heygen.ts     # Lip-sync video generation
  /types          # TypeScript definitions
  /utils          # Utility functions

/app
  /api            # Next.js API routes
    /analyze-video
    /process-localization # Main orchestration
    /text-to-speech
    /generate-video       # HeyGen lip-sync
  page.tsx        # Main UI
```

## 🚀 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/errthdesigns/Localiser-Production-Tool-)

1. Click deploy button
2. Add environment variables:
   - `GEMINI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `HEYGEN_API_KEY`
3. Deploy!

## 🎓 How It Works

### Video Analysis (Gemini)
Gemini's multimodal capabilities analyze both visual and audio:
- Understands what's happening in each scene
- Detects mood, setting, objects, actions
- Transcribes speech with speaker detection
- Provides rich context for translation

### Context-Aware Translation (Gemini)
Translation considers the full context:
- Visual scene information
- Cultural nuances
- Timing requirements for lip-sync
- Emotional tone matching

### Voice Generation (ElevenLabs)
High-quality voice synthesis:
- Natural-sounding speech in 40+ languages
- Emotion and tone preservation
- Timing adjustments for lip-sync
- Professional audio quality

### Automatic Lip-Sync (HeyGen)
AI-powered lip-sync generation:
- Analyzes facial movements in original video
- Generates new mouth movements for translated audio
- Maintains facial expressions and emotions
- Outputs polished, production-ready video

## 📝 License

MIT

## 👏 Credits

Built for **Henkel × Accenture Song**
Powered by Google Gemini, ElevenLabs, and HeyGen
