import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { dubbingId, languageCode, format } = body;

    if (!dubbingId || !languageCode) {
      return NextResponse.json(
        { error: 'dubbingId and languageCode are required' },
        { status: 400 }
      );
    }

    console.log(`Fetching transcript for dubbing ${dubbingId}, language: ${languageCode}, format: ${format || 'json'}`);

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);

    let transcript;
    if (format === 'srt') {
      transcript = await dubbingService.getTranscriptSRT(dubbingId, languageCode);
      return NextResponse.json({
        success: true,
        transcript: transcript,
        format: 'srt',
      });
    } else {
      // Default to JSON format
      transcript = await dubbingService.getTranscript(dubbingId, languageCode);
      return NextResponse.json({
        success: true,
        transcript: transcript,
        format: 'json',
      });
    }

  } catch (error) {
    console.error('Error fetching transcript:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch transcript',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
