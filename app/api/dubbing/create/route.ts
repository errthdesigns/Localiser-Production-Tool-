import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

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

    const body = await request.json();
    const {
      videoUrl,
      targetLanguage,
      sourceLanguage,
      disableVoiceCloning,
      dropBackgroundAudio,
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

    // Download original video
    console.log('Downloading original video...');
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

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Dubbing Job Created in ${duration}s ===`);

    return NextResponse.json({
      success: true,
      dubbingId: job.dubbing_id,
      status: job.status,
      targetLanguage: targetLanguage,
      sourceLanguage: sourceLanguage || job.source_language,
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
