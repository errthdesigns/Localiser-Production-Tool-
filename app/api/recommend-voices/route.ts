import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';
import { VoiceMatchingService } from '@/lib/services/voice-matching';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!geminiApiKey || !elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      );
    }

    // Check if we're receiving JSON (with video URL) or FormData (with file)
    const contentType = request.headers.get('content-type');

    let videoFile: File | null = null;
    let videoUrl: string | null = null;
    let targetLanguage = 'en';

    if (contentType?.includes('application/json')) {
      // Receiving video URL from Blob storage
      const body = await request.json();
      videoUrl = body.videoUrl;
      targetLanguage = body.targetLanguage || 'en';

      if (!videoUrl) {
        return NextResponse.json(
          { error: 'No video URL provided' },
          { status: 400 }
        );
      }

      // Download video from URL
      const response = await fetch(videoUrl);
      const videoBlob = await response.blob();
      videoFile = new File([videoBlob], 'video.mp4', { type: videoBlob.type });
    } else {
      // Receiving direct file upload (for smaller files)
      const formData = await request.formData();
      videoFile = formData.get('video') as File;
      targetLanguage = (formData.get('targetLanguage') as string) || 'en';

      if (!videoFile) {
        return NextResponse.json(
          { error: 'No video file provided' },
          { status: 400 }
        );
      }
    }

    // Analyze voice characteristics
    const geminiService = new GeminiService(geminiApiKey);
    const voiceCharacteristics = await geminiService.analyzeVoiceCharacteristics(videoFile);

    // Find matching voices
    const voiceMatchingService = new VoiceMatchingService(elevenLabsApiKey);
    const recommendations = await voiceMatchingService.getVoiceRecommendations(
      voiceCharacteristics,
      targetLanguage
    );

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Voice recommendation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recommendation failed' },
      { status: 500 }
    );
  }
}
