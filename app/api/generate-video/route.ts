import { NextRequest, NextResponse } from 'next/server';
import { HeyGenService } from '@/lib/services/heygen';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for video processing

export async function POST(request: NextRequest) {
  try {
    const heygenApiKey = process.env.HEYGEN_API_KEY;

    if (!heygenApiKey) {
      return NextResponse.json(
        { error: { message: 'HeyGen API key not configured' } },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const audioFile = formData.get('audio') as File | null;

    if (!videoFile || !audioFile) {
      return NextResponse.json(
        { error: { message: 'Missing video or audio file' } },
        { status: 400 }
      );
    }

    // Convert audio File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });

    const heygenService = new HeyGenService(heygenApiKey);

    // Generate lip-synced video
    const result = await heygenService.generateLipSyncVideo(videoFile, audioBlob, {
      maxWaitTime: 300000, // 5 minutes
      pollInterval: 5000    // Check every 5 seconds
    });

    // Return the video as a blob
    const videoBuffer = await result.videoBlob.arrayBuffer();

    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="localized-video-${result.videoId}.mp4"`,
        'Content-Length': videoBuffer.byteLength.toString(),
        'X-Video-Id': result.videoId,
      },
    });

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Video generation failed' } },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check video status
 */
export async function GET(request: NextRequest) {
  try {
    const heygenApiKey = process.env.HEYGEN_API_KEY;

    if (!heygenApiKey) {
      return NextResponse.json(
        { error: { message: 'HeyGen API key not configured' } },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: { message: 'Missing videoId parameter' } },
        { status: 400 }
      );
    }

    const heygenService = new HeyGenService(heygenApiKey);
    const status = await heygenService.getVideoStatus(videoId);

    return NextResponse.json(status);

  } catch (error) {
    console.error('Video status check error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Status check failed' } },
      { status: 500 }
    );
  }
}
