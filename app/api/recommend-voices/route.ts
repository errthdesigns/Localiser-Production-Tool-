import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';
import { VoiceMatchingService } from '@/lib/services/voice-matching';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    console.log('API Keys check:', {
      hasGemini: !!geminiApiKey,
      hasElevenLabs: !!elevenLabsApiKey
    });

    if (!geminiApiKey || !elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured. Please add GEMINI_API_KEY and ELEVENLABS_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const targetLanguage = (formData.get('targetLanguage') as string) || 'en';

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    console.log('Processing video:', videoFile.name, videoFile.size, 'bytes');

    // Analyze voice characteristics
    console.log('Starting Gemini voice analysis...');
    const geminiService = new GeminiService(geminiApiKey);
    const voiceCharacteristics = await geminiService.analyzeVoiceCharacteristics(videoFile);

    console.log('Voice characteristics:', voiceCharacteristics);

    // Find matching voices
    console.log('Finding matching voices...');
    const voiceMatchingService = new VoiceMatchingService(elevenLabsApiKey);
    const recommendations = await voiceMatchingService.getVoiceRecommendations(
      voiceCharacteristics,
      targetLanguage
    );

    console.log('Recommendations generated:', recommendations.recommendedVoices.length);

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Voice recommendation error:', error);

    // Return detailed error for debugging
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Recommendation failed',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
