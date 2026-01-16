import { NextRequest, NextResponse } from 'next/server';
import { FastDubbingService } from '@/lib/services/fast-dubbing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Fast Dubbing ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!openaiApiKey || !elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      );
    }

    // Check if request is JSON (blob URL) or FormData (direct upload)
    const contentType = request.headers.get('content-type');
    let videoFile: File;
    let targetLanguage: string;
    let sourceLanguage: string | undefined;

    if (contentType?.includes('application/json')) {
      const body = await request.json();
      targetLanguage = body.targetLanguage;
      sourceLanguage = body.sourceLanguage;

      // Fetch video from blob URL
      console.log('Fetching video from blob URL:', body.videoUrl);
      const videoResponse = await fetch(body.videoUrl);
      const videoBlob = await videoResponse.blob();
      videoFile = new File([videoBlob], 'video.mp4', { type: 'video/mp4' });
    } else {
      const formData = await request.formData();
      videoFile = formData.get('video') as File;
      targetLanguage = formData.get('targetLanguage') as string;
      sourceLanguage = formData.get('sourceLanguage') as string | undefined;
    }

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      );
    }

    const fileSizeMB = videoFile.size / 1024 / 1024;
    console.log('Video file:', videoFile.name, '|', fileSizeMB.toFixed(2), 'MB');
    console.log('Target language:', targetLanguage);
    console.log('Source language:', sourceLanguage || 'auto-detect');

    // Limit file size for Whisper API (25 MB max)
    if (fileSizeMB > 25) {
      return NextResponse.json(
        { error: 'Video file too large. Maximum size is 25MB for fast dubbing.' },
        { status: 400 }
      );
    }

    const service = new FastDubbingService(openaiApiKey, elevenLabsApiKey);

    console.log('[1/4] Transcribing audio...');
    const startTime = Date.now();

    const result = await service.dubVideo(
      videoFile,
      targetLanguage,
      sourceLanguage
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Fast Dubbing Complete in ${duration}s ===`);
    console.log('Original text:', result.originalText.substring(0, 100) + '...');
    console.log('Translated text:', result.translatedText.substring(0, 100) + '...');
    console.log('Detected language:', result.detectedLanguage);

    // Convert audio blob to base64 for response
    const audioBuffer = await result.audioBlob.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      originalText: result.originalText,
      translatedText: result.translatedText,
      detectedLanguage: result.detectedLanguage,
      audioData: audioBase64,
      processingTime: duration,
    });

  } catch (error) {
    console.error('=== ERROR in fast-dub ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Fast dubbing failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
