# AI Video Localiser

An AI-powered video localization tool for Accenture Song / Henkel that automatically:
- Transcribes video audio using OpenAI Whisper
- Translates content to target languages using GPT-4
- Generates natural-sounding voice with ElevenLabs
- Verifies translation quality with AI agent
- Provides translated audio for manual video assembly

## Features

- **AI Transcription**: Automatic speech-to-text with OpenAI Whisper
- **Smart Translation**: Context-aware translation with GPT-4o
- **Voice Generation**: Natural multilingual voice with ElevenLabs
- **Quality Verification**: AI agent checks translation accuracy, fluency, cultural fit, and timing
- **Audio Download**: Download translated audio for manual video combination
- **Multi-language Support**: German, French, Spanish, Italian, Dutch, Polish, Portuguese, Japanese

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key (for Whisper + GPT-4)
- ElevenLabs API key (for voice generation)

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
4. **Review**: Check AI translation quality report with detailed metrics
5. **Download Audio**: Download the translated audio file
6. **Combine**: Use your preferred video editor to combine the translated audio with the original video

## API Routes

- `/api/transcribe` - OpenAI Whisper transcription
- `/api/translate` - GPT-4o translation
- `/api/text-to-speech` - ElevenLabs voice generation
- `/api/verify-translation` - AI quality assessment

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/errthdesigns/Localiser-Production-Tool-)

1. Click the deploy button above
2. Add environment variables:
   - `OPENAI_API_KEY`
   - `ELEVENLABS_API_KEY`
3. Deploy!

## Video Assembly

After downloading the translated audio, combine it with your original video using:

### Option 1: Video Editing Software
- **Adobe Premiere Pro**: Import video and audio, replace audio track
- **Final Cut Pro**: Add audio to timeline, remove original audio
- **DaVinci Resolve**: Replace audio in timeline
- **iMovie**: Detach audio, replace with translated version

### Option 2: Cloud Services
- **Cloudinary**: Video transformation API
- **Shotstack**: Video editing API
- **Mux**: Video infrastructure platform

### Option 3: FFmpeg Command Line
```bash
ffmpeg -i original-video.mp4 -i translated-audio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output.mp4
```

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
