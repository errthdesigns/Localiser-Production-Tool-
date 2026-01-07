# AI Video Localiser

An AI-powered video localization tool for Accenture Song / Henkel that automatically:
- Transcribes video audio using OpenAI Whisper
- Translates content to target languages using GPT-4
- Generates natural-sounding voice with ElevenLabs (voice preservation)
- Verifies translation quality with AI agent
- Produces final localized video

## Features

- **AI Transcription**: Automatic speech-to-text with OpenAI Whisper
- **Smart Translation**: Context-aware translation with GPT-4o
- **Voice Cloning**: Natural voice generation with ElevenLabs multilingual models
- **Quality Verification**: AI agent checks translation accuracy, fluency, cultural fit, and timing
- **Video Generation**: Automated video creation with translated audio
- **Multi-language Support**: German, French, Spanish, Italian, Dutch, Polish, Portuguese, Japanese

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key (for Whisper + GPT-4)
- ElevenLabs API key (for voice generation)
- FFmpeg (for video processing - auto-installed on Vercel)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/errthdesigns/Localiser-Production-Tool-.git
cd Localiser-Production-Tool-
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
OPENAI_API_KEY=sk-your-key-here
ELEVENLABS_API_KEY=your-key-here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload Video**: Drag and drop or click to upload your master video
2. **Select Language**: Choose target language for localization
3. **Process**: Click "Start Localization" to begin the pipeline
4. **Review**: Check AI translation quality report
5. **Download**: Download the final localized video or re-run if needed

## API Routes

- `/api/transcribe` - OpenAI Whisper transcription
- `/api/translate` - GPT-4 translation
- `/api/text-to-speech` - ElevenLabs voice generation
- `/api/verify-translation` - AI quality assessment
- `/api/generate-video` - Video production with new audio

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/errthdesigns/Localiser-Production-Tool-)

1. Click the deploy button above
2. Add environment variables:
   - `OPENAI_API_KEY`
   - `ELEVENLABS_API_KEY`
3. Deploy!

**Note**: For video generation on Vercel, you may need to use an external service or Lambda layer with FFmpeg, as Vercel has limited support for native binaries.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Services**:
  - OpenAI (Whisper, GPT-4o)
  - ElevenLabs (Multilingual TTS)
- **Video Processing**: FFmpeg

## Costs

Approximate costs per video (30 seconds):
- Transcription (Whisper): ~$0.003
- Translation (GPT-4o): ~$0.01
- Voice Generation (ElevenLabs): ~$0.30
- Verification (GPT-4o): ~$0.01
- **Total**: ~$0.34 per 30-second video

## License

MIT

## Credits

Built for Henkel × Accenture Song
