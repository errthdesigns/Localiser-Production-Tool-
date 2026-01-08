import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        hasGeminiKey: !!geminiApiKey,
        hasElevenLabsKey: !!elevenLabsApiKey,
        geminiKeyLength: geminiApiKey?.length || 0,
        elevenLabsKeyLength: elevenLabsApiKey?.length || 0,
        geminiKeyPrefix: geminiApiKey?.substring(0, 10) || 'NOT_SET',
        elevenLabsKeyPrefix: elevenLabsApiKey?.substring(0, 10) || 'NOT_SET',
      },
      runtime: 'nodejs',
    };

    console.log('Health check:', health);

    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
