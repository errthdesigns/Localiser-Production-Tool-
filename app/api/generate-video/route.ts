import { NextRequest, NextResponse } from 'next/server';
import { VeedService } from '@/lib/services/veed';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const veedApiKey = process.env.VEED_API_KEY;

    if (!veedApiKey) {
      return NextResponse.json(
        { error: 'VEED_API_KEY not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const audioFile = formData.get('audio') as File;

    if (!videoFile || !audioFile) {
      return NextResponse.json(
        { error: 'Missing video or audio file' },
        { status: 400 }
      );
    }

    // Convert audio File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });

    const veedService = new VeedService(veedApiKey);

    // Generate lip-synced video
    const result = await veedService.generateLipSyncVideo(videoFile, audioBlob, {
      maxWaitTime: 300000,
      pollInterval: 5000
    });

    // Return the video as a blob
    const videoBuffer = await result.videoBlob.arrayBuffer();

    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="localized-video.mp4"`,
        'Content-Length': videoBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 }
    );
  }
}
