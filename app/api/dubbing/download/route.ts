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
export const maxDuration = 300; // 5 minutes

/**
 * Download dubbed audio from existing job and combine with video
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('=== Downloading Dubbed Video from Existing Job ===');

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { dubbingId, targetLanguage, videoUrl } = body;

    if (!dubbingId || !targetLanguage || !videoUrl) {
      return NextResponse.json(
        { error: 'dubbingId, targetLanguage, and videoUrl are required' },
        { status: 400 }
      );
    }

    console.log('Dubbing ID:', dubbingId);
    console.log('Target language:', targetLanguage);
    console.log('Video URL:', videoUrl);

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);

    // Step 1: Download original video
    console.log('[1/3] Downloading original video...');
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video from URL');
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    console.log('Video downloaded:', videoBuffer.byteLength, 'bytes');

    // Step 2: Download dubbed audio from existing dubbing job
    console.log('[2/3] Downloading dubbed audio from ElevenLabs...');
    const dubbedAudioBlob = await dubbingService.downloadDubbedVideo(dubbingId, targetLanguage);
    const dubbedAudioBuffer = await dubbedAudioBlob.arrayBuffer();
    console.log('Dubbed audio downloaded:', dubbedAudioBuffer.byteLength, 'bytes');

    // Step 3: Combine with FFmpeg
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
      console.log(`=== Download Complete in ${duration}s ===`);

      return NextResponse.json({
        success: true,
        videoData: videoBase64,
        dubbingId: dubbingId,
        processingTime: duration,
        message: 'Dubbed video downloaded and combined successfully',
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
    console.error('=== ERROR Downloading Dubbed Video ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Download failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
