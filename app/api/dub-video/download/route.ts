import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dubbingId = searchParams.get('dubbingId');
    const targetLanguage = searchParams.get('targetLanguage');

    if (!dubbingId || !targetLanguage) {
      return NextResponse.json(
        { error: 'dubbingId and targetLanguage parameters are required' },
        { status: 400 }
      );
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('Downloading dubbed video:', dubbingId, targetLanguage);

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);
    const videoBlob = await dubbingService.downloadDubbedVideo(dubbingId, targetLanguage);

    // Convert Blob to ArrayBuffer for response
    const arrayBuffer = await videoBlob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="dubbed-video-${targetLanguage}.mp4"`,
      },
    });
  } catch (error) {
    console.error('Failed to download dubbed video:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download video'
      },
      { status: 500 }
    );
  }
}
