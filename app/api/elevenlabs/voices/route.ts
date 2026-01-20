import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('Fetching available ElevenLabs voices...');

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);
    const voices = await dubbingService.getAvailableVoices(100);

    console.log(`✓ Retrieved ${voices.length} voices`);

    return NextResponse.json({
      success: true,
      voices: voices,
      count: voices.length,
    });

  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch voices',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
