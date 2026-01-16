import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dubbingId = searchParams.get('dubbingId');

    if (!dubbingId) {
      return NextResponse.json(
        { error: 'dubbingId parameter is required' },
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

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);
    const status = await dubbingService.getDubbingStatus(dubbingId);

    return NextResponse.json({
      dubbingId: status.dubbing_id,
      status: status.status,
      targetLanguages: status.target_languages,
      ready: status.status === 'dubbed'
    });
  } catch (error) {
    console.error('Failed to get dubbing status:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get status'
      },
      { status: 500 }
    );
  }
}
