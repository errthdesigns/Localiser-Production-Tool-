import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const replicateApiKey = process.env.REPLICATE_API_TOKEN;

    if (!replicateApiKey) {
      console.error('REPLICATE_API_TOKEN not configured');
      return NextResponse.json(
        { error: 'Replicate API not configured. Please add REPLICATE_API_TOKEN to environment variables.' },
        { status: 500 }
      );
    }

    const { videoUrl, audioUrl } = await request.json();

    if (!videoUrl || !audioUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: videoUrl and audioUrl' },
        { status: 400 }
      );
    }

    console.log('Starting lip-sync with Sync Labs...');
    console.log('Video URL:', videoUrl);
    console.log('Audio URL:', audioUrl);

    // Initialize Replicate client
    const replicate = new Replicate({
      auth: replicateApiKey,
    });

    // Use Sync Labs Lipsync 2 for high-quality commercial lip-sync
    console.log('Calling Sync Labs Lipsync 2 model...');
    const output = await replicate.run(
      "sync-labs/lipsync-2:v1",
      {
        input: {
          video: videoUrl,
          audio: audioUrl,
        }
      }
    );

    console.log('Lip-sync complete!');
    console.log('Output:', output);

    // The output is a URL to the lip-synced video
    const lipsyncedVideoUrl = typeof output === 'string' ? output : (output as any)?.output || (output as any)?.video;

    if (!lipsyncedVideoUrl) {
      console.error('No video URL in output:', output);
      return NextResponse.json(
        { error: 'Lip-sync failed: No video URL returned' },
        { status: 500 }
      );
    }

    // Download the lip-synced video
    console.log('Downloading lip-synced video from:', lipsyncedVideoUrl);
    const videoResponse = await fetch(lipsyncedVideoUrl);

    if (!videoResponse.ok) {
      throw new Error(`Failed to download lip-synced video: ${videoResponse.statusText}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    console.log('Lip-synced video downloaded:', videoBuffer.byteLength, 'bytes');

    // Convert to base64 for response
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Lip-sync processing complete in ${duration}s`);

    return NextResponse.json({
      success: true,
      videoData: videoBase64,
      lipsyncedVideoUrl,
      processingTime: parseFloat(duration),
    });

  } catch (error: any) {
    console.error('Lip-sync error:', error);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json(
      {
        error: error.message || 'Lip-sync processing failed',
        details: error.toString(),
        processingTime: parseFloat(duration),
      },
      { status: 500 }
    );
  }
}
