import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('=== Starting ElevenLabs Dubbing Studio Workflow ===');

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      videoUrl,
      targetLanguage,
      sourceLanguage,
      disableVoiceCloning,
      dropBackgroundAudio,
      audioOnly
    } = body;

    if (!videoUrl || !targetLanguage) {
      return NextResponse.json(
        { error: 'Video URL and target language are required' },
        { status: 400 }
      );
    }

    console.log('Target language:', targetLanguage);
    console.log('Source language:', sourceLanguage || 'auto-detect');
    console.log('Video URL:', videoUrl);
    console.log('Voice cloning:', disableVoiceCloning ? 'DISABLED (using Voice Library)' : 'ENABLED');
    console.log('Background audio:', dropBackgroundAudio ? 'REMOVED' : 'PRESERVED');
    console.log('Output mode:', audioOnly ? 'AUDIO ONLY' : 'VIDEO WITH DUBBED AUDIO');

    // Step 1: Download original video
    console.log('[1/3] Downloading original video...');
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video from URL');
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    console.log('Video downloaded:', videoBuffer.byteLength, 'bytes');

    // Convert to File object for ElevenLabs
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    const fileName = videoUrl.split('/').pop() || 'video.mp4';
    const videoFile = new File([videoBlob], fileName, { type: 'video/mp4' });

    // Step 2: Submit to ElevenLabs Dubbing Studio
    console.log('[2/3] Submitting to ElevenLabs Dubbing Studio...');
    if (disableVoiceCloning) {
      console.log('Using Voice Library voices (voice cloning disabled)');
    } else {
      console.log('This will automatically:');
      console.log('  - Clone all speaker voices');
      console.log('  - Preserve speaker characteristics');
      console.log('  - Maintain perfect timing');
      console.log('  - Handle multiple speakers');
    }

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);

    // Create dubbing job with voice control options
    const job = await dubbingService.createDubbingJob(
      videoFile,
      targetLanguage,
      sourceLanguage,
      {
        disableVoiceCloning: disableVoiceCloning || false,
        dropBackgroundAudio: dropBackgroundAudio || false,
        highestResolution: true,
        dubbingStudio: true, // ENABLE dubbing studio for transcript access
      }
    );

    console.log('Dubbing job created:', job.dubbing_id);
    console.log('Status:', job.status);

    // Wait for dubbing to complete (with polling)
    console.log('Waiting for dubbing to complete (this may take 2-5 minutes)...');
    const completedJob = await dubbingService.waitForDubbing(job.dubbing_id, 600000); // 10 min max

    console.log('Dubbing complete!');

    // Download the dubbed audio
    console.log('Downloading dubbed audio...');
    const dubbedAudioBlob = await dubbingService.downloadDubbedVideo(job.dubbing_id, targetLanguage);
    const dubbedAudioBuffer = await dubbedAudioBlob.arrayBuffer();

    console.log('Dubbed audio downloaded:', dubbedAudioBuffer.byteLength, 'bytes');

    // If audio-only mode, return just the audio
    if (audioOnly) {
      const audioBase64 = Buffer.from(dubbedAudioBuffer).toString('base64');
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`=== Audio-Only Dubbing Complete in ${duration}s ===`);

      return NextResponse.json({
        success: true,
        audioData: audioBase64,
        dubbingId: job.dubbing_id,
        processingTime: duration,
        message: 'Audio dubbed successfully (audio-only mode)',
        audioOnly: true,
      });
    }

    // Step 3: Combine original video with dubbed audio using FFmpeg
    console.log('[3/3] Combining video with dubbed audio...');

    const timestamp = Date.now();
    const videoPath = path.join('/tmp', `input-${timestamp}.mp4`);
    const audioPath = path.join('/tmp', `audio-${timestamp}.mp3`);
    const outputPath = path.join('/tmp', `output-${timestamp}.mp4`);

    try {
      // Write files to /tmp
      await writeFile(videoPath, Buffer.from(videoBuffer));
      await writeFile(audioPath, Buffer.from(dubbedAudioBuffer));

      console.log('Running FFmpeg to combine video and dubbed audio...');

      // Use FFmpeg to replace audio track
      const command = `"${ffmpegPath}" -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;
      console.log('FFmpeg command:', command);

      const { stdout, stderr } = await execAsync(command);
      if (stderr) console.log('FFmpeg stderr:', stderr);
      console.log('FFmpeg execution complete');

      // Read the output video
      const dubbedVideoBuffer = await readFile(outputPath);
      console.log('Dubbed video file read successfully:', dubbedVideoBuffer.length, 'bytes');

      const videoBase64 = dubbedVideoBuffer.toString('base64');
      console.log('Dubbed video base64 encoded:', videoBase64.length, 'characters');

      // Clean up temp files
      await Promise.all([
        unlink(videoPath).catch(() => {}),
        unlink(audioPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
      ]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`=== ElevenLabs Dubbing Complete in ${duration}s ===`);

      return NextResponse.json({
        success: true,
        videoData: videoBase64,
        dubbingId: job.dubbing_id,
        processingTime: duration,
        message: 'Video dubbed with ElevenLabs Dubbing Studio (voice cloning, multiple speakers, perfect timing)',
      });

    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError);

      // Clean up on error
      await Promise.all([
        unlink(videoPath).catch(() => {}),
        unlink(audioPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
      ]);

      throw new Error(`Failed to combine video and audio: ${ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('=== ERROR in ElevenLabs Dubbing Workflow ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Dubbing failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
