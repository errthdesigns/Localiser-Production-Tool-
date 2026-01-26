import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing

/**
 * Create a dubbing job with Dubbing Studio mode enabled
 * Returns immediately with dubbing_id for transcript fetching
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('=== Creating ElevenLabs Dubbing Studio Job ===');

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Accept FormData directly (faster - no Blob storage)
    const formData = await request.formData();
    const videoFile = formData.get('file') as File;
    const targetLanguage = formData.get('targetLanguage') as string;
    const sourceLanguage = formData.get('sourceLanguage') as string;
    const disableVoiceCloning = formData.get('disableVoiceCloning') === 'true';
    const dropBackgroundAudio = formData.get('dropBackgroundAudio') === 'true';

    if (!videoFile || !targetLanguage) {
      return NextResponse.json(
        { error: 'Video file and target language are required' },
        { status: 400 }
      );
    }

    console.log('Target language:', targetLanguage);
    console.log('Source language:', sourceLanguage || 'auto-detect');
    console.log('Video file:', videoFile.name, 'size:', (videoFile.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Voice cloning:', disableVoiceCloning ? 'DISABLED (using Voice Library)' : 'ENABLED');
    console.log('Background audio:', dropBackgroundAudio ? 'REMOVED' : 'PRESERVED');

    // Create dubbing job with Dubbing Studio mode
    console.log('Submitting to ElevenLabs Dubbing Studio...');
    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);

    const job = await dubbingService.createDubbingJob(
      videoFile,
      targetLanguage,
      sourceLanguage,
      {
        disableVoiceCloning: disableVoiceCloning || false,
        dropBackgroundAudio: dropBackgroundAudio || false,
        highestResolution: true,
        dubbingStudio: true, // CRITICAL: Enable dubbing studio mode
      }
    );

    console.log('Dubbing job created:', job.dubbing_id);
    console.log('Status:', job.status);

    // Also upload to Blob storage for later download (in background)
    console.log('Uploading video to Blob storage...');
    const blob = await put(videoFile.name, videoFile, {
      access: 'public',
      addRandomSuffix: true
    });
    console.log('Video uploaded to Blob:', blob.url);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Dubbing Job Created in ${duration}s ===`);

    return NextResponse.json({
      success: true,
      dubbingId: job.dubbing_id,
      status: job.status,
      targetLanguage: targetLanguage,
      sourceLanguage: sourceLanguage || job.source_language,
      videoUrl: blob.url, // Return for later download
      processingTime: duration,
      message: 'Dubbing job created successfully. Use dubbing ID to fetch transcripts and translations.',
    });

  } catch (error) {
    console.error('=== ERROR Creating Dubbing Job ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create dubbing job',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
