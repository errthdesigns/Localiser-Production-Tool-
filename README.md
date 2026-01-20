# ScriptShift

**Transform your videos into any language with AI-powered voice cloning and dubbing**

Professional video localization tool featuring:
- **AssemblyAI** for accurate speech-to-text with speaker diarization
- **GPT-4** for professional translation
- **ElevenLabs Dubbing Studio** for enterprise-grade voice cloning and dubbing
- **Beautiful modern UI** with ScriptShift branding
- **Ready for HeyGen** lip-sync integration

## 🎯 Workflow

1. **Upload Video** → Choose target language (English, Spanish, French, or Italian)
2. **AI Transcription** → AssemblyAI transcribes with automatic speaker detection
3. **Review English** → Edit the English transcript if needed
4. **AI Translation** → GPT-4 translates to target language
5. **Review Translation** → Edit the translation side-by-side with English
6. **Professional Dubbing** → ElevenLabs Dubbing Studio:
   - Automatically clones all speaker voices
   - Preserves speaker characteristics and emotions
   - Maintains perfect timing synchronization
   - Generates professional multi-voice dubbed audio
7. **Download** → Complete dubbed video ready for distribution!

## 🎬 Key Features

### Voice Cloning
ElevenLabs Enterprise automatically:
- Analyzes each speaker's unique voice characteristics
- Creates realistic voice clones for each speaker
- Preserves emotional tone and speaking style
- Maintains speaker differentiation (Speaker 1 sounds like Speaker 1, etc.)

### Perfect Timing
- Matches original video pacing and duration
- Preserves natural speech flow
- No awkward gaps or rushing

### Modern UI
- **ScriptShift** branding with gradient design
- Clean, professional interface perfect for client demos
- Clear step-by-step workflow
- No confusing options or toggles

## 🚀 Tech Stack

- **Next.js 14** - React framework with App Router
- **AssemblyAI** - Professional speech-to-text with speaker diarization
- **OpenAI GPT-4** - Translation engine
- **ElevenLabs Dubbing Studio** - Enterprise voice cloning and dubbing
- **FFmpeg** - Video/audio processing
- **Vercel Blob** - File storage
- **Tailwind CSS** - Modern styling
- **TypeScript** - Type safety

## 🔧 Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (`.env`):
   ```bash
   ASSEMBLYAI_API_KEY=your-assemblyai-key
   OPENAI_API_KEY=your-openai-key
   ELEVENLABS_API_KEY=your-elevenlabs-key
   BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
/app
  /api
    /transcribe         - AssemblyAI transcription with speaker diarization
    /translate-preview  - GPT-4 translation preview
    /translate-and-dub  - ElevenLabs Dubbing Studio integration
    /upload            - Vercel Blob file upload
  page.tsx             - Main UI with ScriptShift branding

/lib
  /services
    elevenlabs-dubbing.ts - ElevenLabs Dubbing Studio service
```

## 🎨 UI Design

Modern, professional design inspired by enterprise design systems:
- **Gradient backgrounds** (blue → purple → pink)
- **Rounded corners** for modern aesthetic
- **Smooth animations** and hover effects
- **Clear visual hierarchy** with emojis and icons
- **Responsive** layout

## 🔮 Coming Soon

- **HeyGen Integration** - AI lip-sync for perfect mouth movements
- **More Languages** - Expand to support 20+ languages
- **Batch Processing** - Process multiple videos at once
- **Advanced Editing** - Fine-tune dubbing in the browser

## 📝 License

Private - All rights reserved

---

Built with ❤️ by the ScriptShift team
