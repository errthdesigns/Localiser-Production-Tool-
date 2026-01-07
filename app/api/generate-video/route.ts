import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for video processing

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const audioFile = formData.get('audio') as File | null;

    if (!videoFile || !audioFile) {
      return NextResponse.json(
        { error: { message: 'Missing video or audio file' } },
        { status: 400 }
      );
    }

    // For Vercel deployment without FFmpeg, we'll return an error message
    // In production, you should use a service like:
    // - Cloudinary (cloudinary.com)
    // - Shotstack (shotstack.io)
    // - Mux (mux.com)
    // - AWS Lambda with FFmpeg layer

    return NextResponse.json(
      {
        error: {
          message: 'Video generation requires FFmpeg which is not available on Vercel. Please use the translated audio file separately, or integrate a cloud video service like Cloudinary, Shotstack, or Mux.',
          audioAvailable: true,
          suggestion: 'Download the translated audio and combine it with your video using a local video editor or cloud service.'
        }
      },
      { status: 501 } // 501 Not Implemented
    );

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Video generation failed' } },
      { status: 500 }
    );
  }
}
