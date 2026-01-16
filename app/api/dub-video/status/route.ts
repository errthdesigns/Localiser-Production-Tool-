import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Prevent static generation

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

    console.log(`[Status Check] Checking dubbing status for ID: ${dubbingId}`);

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);
    const status = await dubbingService.getDubbingStatus(dubbingId);

    console.log(`[Status Check] ElevenLabs response:`, JSON.stringify(status, null, 2));

    const responseData = {
      dubbingId: status.dubbing_id,
      status: status.status,
      targetLanguages: status.target_languages,
      ready: status.status === 'dubbed'
    };

    console.log(`[Status Check] Returning:`, JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[Status Check] ERROR:', error);
    console.error('[Status Check] Error details:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get status'
      },
      { status: 500 }
    );
  }
}
