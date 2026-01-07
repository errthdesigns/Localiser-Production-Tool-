import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: { message: 'Gemini API key not configured' } },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const analysisType = formData.get('type') as string || 'full'; // 'full' | 'transcribe' | 'context'

    if (!videoFile) {
      return NextResponse.json(
        { error: { message: 'No video file provided' } },
        { status: 400 }
      );
    }

    const geminiService = new GeminiService(geminiApiKey);

    let result;

    switch (analysisType) {
      case 'transcribe':
        result = await geminiService.transcribeVideo(videoFile);
        break;
      case 'context':
        result = await geminiService.getVisualContext(videoFile);
        break;
      case 'full':
      default:
        result = await geminiService.analyzeVideo(videoFile);
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      analysisType
    });

  } catch (error) {
    console.error('Video analysis error:', error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Video analysis failed'
        }
      },
      { status: 500 }
    );
  }
}
