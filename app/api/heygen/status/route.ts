import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Check HeyGen video translation status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
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

    // Check status
    const response = await fetch(`https://api.heygen.com/v1/video_translate/${jobId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': heygenApiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to check status' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      jobId: jobId,
      status: data.status, // 'pending' | 'processing' | 'completed' | 'failed'
      ready: data.status === 'completed',
      videoUrl: data.video_url, // Available when status is 'completed'
      progress: data.progress || 0,
    });

  } catch (error) {
    console.error('HeyGen status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    );
  }
}
