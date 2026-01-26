import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsDubbingService } from '@/lib/services/elevenlabs-dubbing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Declare variables outside try block so they're accessible in catch
  let dubbingId: string | undefined;
  let languageCode: string | undefined;
  let format: string | undefined;

  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    dubbingId = body.dubbingId;
    languageCode = body.languageCode;
    format = body.format;

    if (!dubbingId || !languageCode) {
      return NextResponse.json(
        { error: 'dubbingId and languageCode are required' },
        { status: 400 }
      );
    }

    console.log(`[Transcript API] Fetching transcript for dubbing ${dubbingId}, language: ${languageCode}, format: ${format || 'json'}`);

    const dubbingService = new ElevenLabsDubbingService(elevenLabsApiKey);

    let transcript;
    if (format === 'srt') {
      transcript = await dubbingService.getTranscriptSRT(dubbingId, languageCode);
      console.log(`[Transcript API] ✓ SRT transcript fetched successfully`);
      return NextResponse.json({
        success: true,
        transcript: transcript,
        format: 'srt',
      });
    } else {
      // Default to JSON format
      transcript = await dubbingService.getTranscript(dubbingId, languageCode);
      console.log(`[Transcript API] ✓ JSON transcript fetched successfully`);
      return NextResponse.json({
        success: true,
        transcript: transcript,
        format: 'json',
      });
    }

  } catch (error) {
    console.error('[Transcript API] ✗ Error fetching transcript:', error);
    console.error('[Transcript API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      dubbingId,
      languageCode,
      format: format || 'json'
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch transcript',
        details: error instanceof Error ? error.stack : undefined,
        dubbingId,
        languageCode
      },
      { status: 500 }
    );
  }
}
