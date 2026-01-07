import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsService } from '@/lib/services/elevenlabs';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'ElevenLabs API key not configured' } },
        { status: 500 }
      );
    }

    const { text, voiceId = 'default', modelId = 'eleven_multilingual_v2', settings } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: { message: 'Missing required field: text' } },
        { status: 400 }
      );
    }

    const elevenLabsService = new ElevenLabsService(apiKey);

    const result = await elevenLabsService.generateSpeech({
      text,
      voiceId,
      language: 'auto', // Auto-detect language
      settings
    });

    // Return the audio as a blob
    const audioBuffer = await result.audioBlob.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Text-to-speech error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Text-to-speech failed' } },
      { status: 500 }
    );
  }
}

// GET endpoint to list available voices
export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'ElevenLabs API key not configured' } },
        { status: 500 }
      );
    }

    const elevenLabsService = new ElevenLabsService(apiKey);
    const voices = await elevenLabsService.getVoices();

    return NextResponse.json({ voices });

  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to fetch voices' } },
      { status: 500 }
    );
  }
}
