import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';
import { VoiceMatchingService } from '@/lib/services/voice-matching';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute for voice analysis

/**
 * Analyze original voice and recommend matching ElevenLabs voices
 */
export async function POST(request: NextRequest) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!geminiApiKey || !elevenLabsApiKey) {
      return NextResponse.json(
        { error: { message: 'Required API keys not configured' } },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const targetLanguage = formData.get('targetLanguage') as string || 'English';
    const maxResults = parseInt(formData.get('maxResults') as string || '5');

    if (!videoFile) {
      return NextResponse.json(
        { error: { message: 'No video file provided' } },
        { status: 400 }
      );
    }

    // Step 1: Analyze original voice characteristics
    console.log('Analyzing original voice characteristics...');
    const geminiService = new GeminiService(geminiApiKey);
    const voiceCharacteristics = await geminiService.analyzeVoiceCharacteristics(videoFile);

    // Step 2: Find matching ElevenLabs voices
    console.log('Finding matching voices...');
    const voiceMatchingService = new VoiceMatchingService(elevenLabsApiKey);
    const recommendations = await voiceMatchingService.getVoiceRecommendations(
      voiceCharacteristics,
      targetLanguage
    );

    return NextResponse.json({
      success: true,
      data: {
        originalVoice: voiceCharacteristics,
        recommendations: recommendations.recommendedVoices.slice(0, maxResults),
        summary: recommendations.summary,
        metadata: {
          analyzedAt: new Date().toISOString(),
          totalVoicesAnalyzed: recommendations.recommendedVoices.length
        }
      }
    });

  } catch (error) {
    console.error('Voice recommendation error:', error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Voice recommendation failed',
          details: error instanceof Error ? error.stack : undefined
        }
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to fetch voice recommendations using a cached voice analysis
 * Query params: voiceCharacteristics (JSON string), targetLanguage, maxResults
 */
export async function GET(request: NextRequest) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: { message: 'ElevenLabs API key not configured' } },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const voiceCharacteristicsJson = searchParams.get('voiceCharacteristics');
    const targetLanguage = searchParams.get('targetLanguage') || 'English';
    const maxResults = parseInt(searchParams.get('maxResults') || '5');

    if (!voiceCharacteristicsJson) {
      return NextResponse.json(
        { error: { message: 'Missing voiceCharacteristics parameter' } },
        { status: 400 }
      );
    }

    const voiceCharacteristics = JSON.parse(voiceCharacteristicsJson);

    const voiceMatchingService = new VoiceMatchingService(elevenLabsApiKey);
    const recommendations = await voiceMatchingService.getVoiceRecommendations(
      voiceCharacteristics,
      targetLanguage
    );

    return NextResponse.json({
      success: true,
      data: {
        recommendations: recommendations.recommendedVoices.slice(0, maxResults),
        summary: recommendations.summary
      }
    });

  } catch (error) {
    console.error('Voice recommendation error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Voice recommendation failed' } },
      { status: 500 }
    );
  }
}
