# ScriptShift - AI Video Dubbing Studio

**Production-ready async video dubbing pipeline replicating ElevenLabs Dubbing Studio UX**

## Features

✅ **Async Job Queue** (BullMQ + Redis) - Non-blocking processing with real-time progress
✅ **Speaker Diarization** (AssemblyAI) - Automatic speaker detection with timestamps
✅ **Professional Translation** (OpenAI GPT-4) - Contextual translation per segment
✅ **Voice Mapping** - Assign custom ElevenLabs voices to each speaker
✅ **Transcript Editor** - Edit translated text per segment before generation
✅ **Background Audio Preservation** - Ducking strategy keeps SFX intact
✅ **SHA256 Caching** - Reuse transcripts/translations for same files
✅ **Instant Video Preview** - See uploaded video immediately
✅ **Real-time Progress** - Live job status with pipeline stages

## Quick Start

### Prerequisites

- Node.js 18+
- Redis server (local or cloud)
- API Keys: AssemblyAI, OpenAI, ElevenLabs
- Vercel Blob token (for storage)

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in:

```bash
# Required
ASSEMBLYAI_API_KEY=your-key-here
OPENAI_API_KEY=sk-your-key-here
ELEVENLABS_API_KEY=your-key-here
REDIS_URL=redis://localhost:6379
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Optional
HEYGEN_API_KEY=your-key-here  # For lip-sync (not yet enabled)
DATABASE_PATH=./data/scriptshift.db
```

### Run Development

**Terminal 1 - Start Redis:**
```bash
redis-server
```

**Terminal 2 - Start Worker:**
```bash
npm run worker
```

**Terminal 3 - Start Web Server:**
```bash
npm run dev
```

Open http://localhost:3000

## Workflow

1. **Upload** → Select video + target language → Instant preview
2. **Processing** (async) → Extract audio → Transcribe → Translate → Store in DB
3. **Transcript Editor** → Review/edit segments + Assign voices per speaker
4. **Generate** → TTS per segment → Mix with ducking → Export MP4
5. **Download** → Preview + download final video

## Architecture

### Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Queue:** BullMQ + Redis (async processing)
- **Database:** SQLite (better-sqlite3)
- **Storage:** Vercel Blob
- **Media:** FFmpeg
- **APIs:** AssemblyAI, OpenAI, ElevenLabs

### Pipeline Stages

```
upload → extract_audio → transcribe_diarize → translate →
[USER EDITS] → tts_generate → mix_ducking → export_mp4
```

### Caching Strategy

- **File hash:** SHA256 of uploaded video
- **Transcripts:** Cached by `file_hash + language`
- **Artifacts:** Audio files, stems cached by hash
- **Re-uploads:** Same file = instant results

## Project Structure

```
/app
  /api
    /jobs
      /upload               - SHA256 hash + Vercel Blob upload
      /[id]/status          - Job progress polling
      /[id]/transcript      - GET/POST transcript editing
      /[id]/voices          - Voice mapping per speaker
    /elevenlabs/voices      - List available voices
  page.tsx                  - Main UI (4 screens)

/lib
  db.ts                     - SQLite schema + queries
  queue.ts                  - BullMQ setup
  /services
    elevenlabs-dubbing.ts   - Voice API integration

worker.ts                   - Background job processor
```

## Database Schema

### `jobs`
Tracks dubbing jobs with status, progress, errors

### `transcripts`
Stores speaker-diarized transcripts (original + translated)

### `voice_mappings`
Maps speakers to ElevenLabs voice IDs

### `artifacts`
URLs to generated files (audio, video, stems)

### `cache`
General key-value cache with TTL

## API Routes

### POST `/api/jobs/upload`
Upload video, compute hash, create job, add to queue

### GET `/api/jobs/[id]/status`
Real-time job status + progress + artifacts

### GET `/api/jobs/[id]/transcript?language=es`
Fetch transcript for job

### POST `/api/jobs/[id]/transcript`
Update edited transcript segments

### POST `/api/jobs/[id]/voices`
Map speaker to ElevenLabs voice

### GET `/api/elevenlabs/voices`
List available ElevenLabs voices

## Audio Strategy

**Current Implementation:** Volume ducking (fallback)
- Original audio at 25% volume during speech
- Dubbed audio overlaid at full volume
- Preserves background music/SFX

**Future:** Source separation with Demucs/UVR (experimental)

## Production Deployment

### Vercel (Web + API)

1. Set environment variables in Vercel dashboard
2. Add Redis Cloud/Upstash integration
3. Deploy: `vercel --prod`

### Worker (Railway/Render/Heroku)

Deploy worker separately:

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["npm", "run", "worker"]
```

Set same environment variables as web app.

## Troubleshooting

**Worker not processing:**
- Check Redis connection
- Verify worker is running (`npm run worker`)
- Check logs for errors

**Timeout errors:**
- Increase API timeouts in worker.ts
- Check AssemblyAI/OpenAI/ElevenLabs status
- Verify Redis connection

**File size limits:**
- Default: 50MB
- Adjust in upload route if needed

## Development Notes

- Worker runs separately for scalability
- Can run multiple workers in parallel
- Automatic retries on failure
- Temp files auto-cleanup
- SQLite for simplicity (migrate to Postgres for production scale)

## Coming Soon

- [ ] HeyGen lip-sync integration
- [ ] Demucs audio separation
- [ ] Job history UI
- [ ] Batch processing
- [ ] More languages (20+)

## License

MIT
