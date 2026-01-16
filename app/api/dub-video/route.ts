import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for dubbing

export async function POST(request: NextRequest) {
  try {
    console.log('=== DUB VIDEO API CALLED ===');

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Check if this is JSON (blob URL) or FormData (direct upload)
    const contentType = request.headers.get('content-type');
    let videoFile: File;
    let targetLanguage: string;
    let sourceLanguage: string | undefined;

    if (contentType?.includes('application/json')) {
      // Handle blob URL
      console.log('Handling blob URL upload...');
      const body = await request.json();
      const videoUrl = body.videoUrl;
      targetLanguage = body.targetLanguage;
      sourceLanguage = body.sourceLanguage;

      console.log('Fetching video from blob:', videoUrl);

      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to fetch video from blob storage');
      }

      const videoBlob = await videoResponse.blob();
      const fileName = videoUrl.split('/').pop() || 'video.mp4';
      videoFile = new File([videoBlob], fileName, { type: videoBlob.type || 'video/mp4' });
    } else {
      // Handle direct FormData upload
      console.log('Handling direct FormData upload...');
      const formData = await request.formData();
      videoFile = formData.get('video') as File;
      targetLanguage = (formData.get('targetLanguage') as string) || 'es';
      sourceLanguage = (formData.get('sourceLanguage') as string) || undefined;

      if (!videoFile) {
        return NextResponse.json(
          { error: 'No video file provided' },
          { status: 400 }
        );
      }
    }

    console.log('=== Starting ElevenLabs dubbing process ===');
    console.log('Video file:', videoFile.name, '|', (videoFile.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Target language:', targetLanguage);
    console.log('Source language:', sourceLanguage || 'auto-detect');

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);

    // Create dubbing job
    console.log('Creating dubbing job with ElevenLabs API...');
    const job = await dubbingService.createDubbingJob(
      videoFile,
      targetLanguage,
      sourceLanguage
    );

    console.log('=== Dubbing job created successfully ===');
    console.log('Dubbing ID:', job.dubbing_id);
    console.log('Initial Status:', job.status);
    console.log('Target Languages:', job.target_languages);

    return NextResponse.json({
      success: true,
      dubbingId: job.dubbing_id,
      status: job.status,
      targetLanguages: job.target_languages,
      message: 'Dubbing job created successfully. Use /api/dub-video/status to check progress.'
    });
  } catch (error) {
    console.error('=== ERROR in dub-video ===');
    console.error('Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Dubbing failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
