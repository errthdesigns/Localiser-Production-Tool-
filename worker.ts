import { Worker, Job } from 'bullmq';
import { connection, DubbingJobData, JobProgress } from './lib/queue';
import { jobQueries, transcriptQueries, artifactQueries, parseTranscript } from './lib/db';
import { createHash } from 'crypto';
import { AssemblyAI } from 'assemblyai';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Initialize API clients
const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Worker to process dubbing jobs
const worker = new Worker<DubbingJobData>(
  'dubbing',
  async (job: Job<DubbingJobData>) => {
    const { jobId, fileHash, fileUrl, targetLanguage, enableLipSync } = job.data;

    console.log(`[Worker] Processing job ${jobId}`);

    try {
      // Update job status
      const updateProgress = (stage: string, progress: number, message?: string) => {
        const now = Date.now();
        jobQueries.updateStatus.run(
          'processing',
          progress,
          stage,
          now,
          jobId
        );
        job.updateProgress({ stage, progress, message } as JobProgress);
        console.log(`[Worker] ${jobId} - ${stage} (${progress}%): ${message || ''}`);
      };

      updateProgress('initializing', 0, 'Starting dubbing pipeline');

      // STAGE 1: Download and extract audio
      updateProgress('extract_audio', 5, 'Downloading video and extracting audio');
      const audioPath = await extractAudio(fileUrl, fileHash);

      // STAGE 2: Check for cached transcript
      updateProgress('transcribe', 10, 'Checking for cached transcript');
      let transcript = transcriptQueries.getByHashAndLang.get(fileHash, 'auto') as any;

      if (transcript) {
        console.log(`[Worker] Using cached transcript for ${fileHash}`);
        transcript = parseTranscript(transcript);
      } else {
        // STAGE 3: Transcribe and diarize with AssemblyAI
        updateProgress('transcribe', 15, 'Transcribing audio with speaker diarization');
        transcript = await transcribeWithDiarization(audioPath, jobId, fileHash);
      }

      // STAGE 4: Translate transcript
      updateProgress('translate', 40, `Translating to ${targetLanguage}`);
      const translatedTranscript = await translateTranscript(
        transcript,
        targetLanguage,
        jobId,
        fileHash
      );

      // STAGE 5: Generate dubbed audio for each segment
      updateProgress('generate_tts', 60, 'Generating dubbed speech with ElevenLabs');
      const dubbedAudioPath = await generateDubbedAudio(
        translatedTranscript,
        jobId,
        fileHash,
        (progress) => {
          updateProgress('generate_tts', 60 + (progress / 100) * 20, `Generating TTS: ${progress}%`);
        }
      );

      // STAGE 6: Mix dubbed audio with original video
      updateProgress('mix_audio', 85, 'Mixing dubbed audio with video');
      const finalVideoPath = await mixAudioWithVideo(
        fileUrl,
        dubbedAudioPath,
        jobId,
        fileHash
      );

      // STAGE 7: Upload final video
      updateProgress('upload', 90, 'Uploading final video');
      const finalVideoUrl = await uploadToBlob(finalVideoPath, `${fileHash}-dubbed-${targetLanguage}.mp4`);

      // Save artifact
      artifactQueries.create.run(
        jobId,
        fileHash,
        'final_video',
        finalVideoUrl,
        JSON.stringify({ target_language: targetLanguage }),
        Date.now()
      );

      // STAGE 8: Optional lip-sync with HeyGen
      let lipsyncedVideoUrl: string | undefined;
      if (enableLipSync) {
        updateProgress('lipsync', 95, 'Processing lip-sync with HeyGen');
        lipsyncedVideoUrl = await processLipSync(finalVideoUrl, jobId);

        if (lipsyncedVideoUrl) {
          artifactQueries.create.run(
            jobId,
            fileHash,
            'lipsynced_video',
            lipsyncedVideoUrl,
            JSON.stringify({ target_language: targetLanguage }),
            Date.now()
          );
        }
      }

      // Complete job
      const now = Date.now();
      jobQueries.complete.run(now, now, jobId);

      updateProgress('complete', 100, 'Dubbing completed successfully');

      // Cleanup temp files
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        if (fs.existsSync(dubbedAudioPath)) fs.unlinkSync(dubbedAudioPath);
        if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);
      } catch (err) {
        console.error('[Worker] Cleanup error:', err);
      }

      return {
        success: true,
        videoUrl: lipsyncedVideoUrl || finalVideoUrl,
        transcript,
        translatedTranscript
      };

    } catch (error) {
      console.error(`[Worker] Job ${jobId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      jobQueries.setError.run(errorMessage, Date.now(), jobId);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 jobs in parallel
    limiter: {
      max: 5, // Max 5 jobs per duration
      duration: 60000 // per minute
    }
  }
);

// Helper functions
async function extractAudio(videoUrl: string, fileHash: string): Promise<string> {
  // Check cache
  const cached = artifactQueries.getByHashAndType.get(fileHash, 'extracted_audio') as any;
  if (cached) {
    console.log(`[Worker] Using cached audio for ${fileHash}`);
    // Download from cache URL
    const audioPath = path.join(TEMP_DIR, `${fileHash}-audio.mp3`);
    const response = await fetch(cached.url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(audioPath, Buffer.from(buffer));
    return audioPath;
  }

  // Download video
  const videoPath = path.join(TEMP_DIR, `${fileHash}-video.mp4`);
  const response = await fetch(videoUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(videoPath, Buffer.from(buffer));

  // Extract audio with FFmpeg
  const audioPath = path.join(TEMP_DIR, `${fileHash}-audio.mp3`);
  await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${audioPath}" -y`);

  fs.unlinkSync(videoPath);

  return audioPath;
}

async function transcribeWithDiarization(audioPath: string, jobId: string, fileHash: string) {
  const transcript = await assemblyai.transcripts.transcribe({
    audio: audioPath,
    speaker_labels: true,
    language_detection: true
  });

  if (transcript.status === 'error') {
    throw new Error(`Transcription failed: ${transcript.error}`);
  }

  const speakers = new Set<string>();
  const segments = transcript.utterances?.map(utterance => {
    const speaker = `Speaker ${utterance.speaker}`;
    speakers.add(speaker);
    return {
      start: utterance.start / 1000, // Convert to seconds
      end: utterance.end / 1000,
      speaker,
      text: utterance.text,
      confidence: utterance.confidence
    };
  }) || [];

  const transcriptData = {
    job_id: jobId,
    file_hash: fileHash,
    language: transcript.language_code || 'en',
    speakers: JSON.stringify(Array.from(speakers)),
    segments: JSON.stringify(segments),
    created_at: Date.now()
  };

  transcriptQueries.create.run(
    transcriptData.job_id,
    transcriptData.file_hash,
    transcriptData.language,
    transcriptData.speakers,
    transcriptData.segments,
    transcriptData.created_at
  );

  return {
    id: 0,
    job_id: jobId,
    file_hash: fileHash,
    language: transcript.language_code || 'en',
    speakers: Array.from(speakers),
    segments,
    created_at: Date.now()
  };
}

async function translateTranscript(transcript: any, targetLang: string, jobId: string, fileHash: string) {
  // Check cache
  const cached = transcriptQueries.getByHashAndLang.get(fileHash, targetLang) as any;
  if (cached) {
    console.log(`[Worker] Using cached translation for ${fileHash} to ${targetLang}`);
    return parseTranscript(cached);
  }

  // Translate segments
  const translatedSegments = await Promise.all(
    transcript.segments.map(async (segment: any) => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Translate the following text to ${targetLang}. Preserve the tone and style. Return only the translation, no explanations.`
          },
          {
            role: 'user',
            content: segment.text
          }
        ],
        temperature: 0.3
      });

      return {
        ...segment,
        text: response.choices[0].message.content || segment.text
      };
    })
  );

  const translatedTranscriptData = {
    job_id: jobId,
    file_hash: fileHash,
    language: targetLang,
    speakers: JSON.stringify(transcript.speakers),
    segments: JSON.stringify(translatedSegments),
    created_at: Date.now()
  };

  transcriptQueries.create.run(
    translatedTranscriptData.job_id,
    translatedTranscriptData.file_hash,
    translatedTranscriptData.language,
    translatedTranscriptData.speakers,
    translatedTranscriptData.segments,
    translatedTranscriptData.created_at
  );

  return {
    ...transcript,
    language: targetLang,
    segments: translatedSegments
  };
}

async function generateDubbedAudio(
  transcript: any,
  jobId: string,
  fileHash: string,
  onProgress: (progress: number) => void
): Promise<string> {
  // For now, use a simple TTS approach
  // TODO: Implement ElevenLabs TTS per segment with voice mapping

  const outputPath = path.join(TEMP_DIR, `${fileHash}-dubbed.mp3`);

  // This is a placeholder - you'll need to implement actual ElevenLabs TTS
  // For now, just copy the original audio
  throw new Error('TTS generation not yet implemented - please implement ElevenLabs TTS per segment');
}

async function mixAudioWithVideo(
  videoUrl: string,
  audioPath: string,
  jobId: string,
  fileHash: string
): Promise<string> {
  const videoPath = path.join(TEMP_DIR, `${fileHash}-original.mp4`);
  const response = await fetch(videoUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(videoPath, Buffer.from(buffer));

  const outputPath = path.join(TEMP_DIR, `${fileHash}-final.mp4`);

  // Mix audio with video
  await execAsync(
    `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}" -y`
  );

  fs.unlinkSync(videoPath);

  return outputPath;
}

async function uploadToBlob(filePath: string, filename: string): Promise<string> {
  // TODO: Implement Vercel Blob upload
  // For now, return a placeholder
  return `https://blob.vercel-storage.com/${filename}`;
}

async function processLipSync(videoUrl: string, jobId: string): Promise<string | undefined> {
  // TODO: Implement HeyGen lip-sync
  return undefined;
}

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

console.log('[Worker] Dubbing worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  process.exit(0);
});
