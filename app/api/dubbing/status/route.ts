import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Check the status of a dubbing job
 */
export async function GET(request: NextRequest) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dubbingId = searchParams.get('dubbingId');

    if (!dubbingId) {
      return NextResponse.json(
        { error: 'dubbingId is required' },
        { status: 400 }
      );
    }

    console.log(`Checking status for dubbing job: ${dubbingId}`);

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);
    const status = await dubbingService.getDubbingStatus(dubbingId);

    console.log(`Dubbing status: ${status.status}`);

    return NextResponse.json({
      success: true,
      dubbingId: status.dubbing_id,
      status: status.status,
      ready: status.status === 'dubbed',
      targetLanguages: status.target_languages,
      sourceLanguage: status.source_language,
    });

  } catch (error) {
    console.error('Error checking dubbing status:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to check status',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
