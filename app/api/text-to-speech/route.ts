import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'ElevenLabs API key not configured' } },
        { status: 500 }
      );
    }

    const { text, voiceId = 'default', modelId = 'eleven_multilingual_v2' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: { message: 'Missing required field: text' } },
        { status: 400 }
      );
    }

    // Call ElevenLabs text-to-speech API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      return NextResponse.json(
        { error: { message: `ElevenLabs API error: ${response.statusText}` } },
        { status: response.status }
      );
    }

    // Return the audio as a blob
    const audioBuffer = await response.arrayBuffer();

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

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: { message: 'Failed to fetch voices' } },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to fetch voices' } },
      { status: 500 }
    );
  }
}
