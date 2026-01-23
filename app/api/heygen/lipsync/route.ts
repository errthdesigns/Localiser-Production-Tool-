import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * HeyGen Video Translation API
 * Lip-syncs dubbed video to match new audio
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, audioUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    const heygenApiKey = process.env.HEYGEN_API_KEY;

    if (!heygenApiKey) {
      return NextResponse.json(
        { error: 'HeyGen API key is not configured' },
        { status: 500 }
      );
    }

    console.log('Creating HeyGen video translation job...');

    // HeyGen Video Translation API
    // https://docs.heygen.com/reference/video-translate
    const response = await fetch('https://api.heygen.com/v1/video_translate', {
      method: 'POST',
      headers: {
        'X-Api-Key': heygenApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: videoUrl,
        audio_url: audioUrl, // Optional: provide dubbed audio
        output_language: 'auto', // Auto-detect from audio
        translate: false, // We already have translation, just need lip-sync
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('HeyGen API error:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'HeyGen API request failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      jobId: data.video_id,
      status: data.status,
    });

  } catch (error) {
    console.error('HeyGen lip-sync error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'HeyGen lip-sync failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
