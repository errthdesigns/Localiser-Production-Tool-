import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';
import { VoiceMatchingService } from '@/lib/services/voice-matching';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('=== RECOMMEND VOICES API CALLED ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    console.log('API Keys check:', {
      hasGemini: !!geminiApiKey,
      hasElevenLabs: !!elevenLabsApiKey,
      geminiLength: geminiApiKey?.length || 0,
      elevenLabsLength: elevenLabsApiKey?.length || 0,
      geminiPrefix: geminiApiKey?.substring(0, 15) || 'NOT_SET',
      elevenLabsPrefix: elevenLabsApiKey?.substring(0, 15) || 'NOT_SET'
    });

    if (!geminiApiKey || !elevenLabsApiKey) {
      console.error('Missing API keys!');
      return NextResponse.json(
        { error: 'API keys not configured. Please add GEMINI_API_KEY and ELEVENLABS_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Check if this is JSON (blob URL) or FormData (direct upload)
    const contentType = request.headers.get('content-type');
    let videoFile: File;
    let targetLanguage = 'en';

    if (contentType?.includes('application/json')) {
      // Handle blob URL
      console.log('Handling blob URL upload...');
      const body = await request.json();
      const videoUrl = body.videoUrl;
      targetLanguage = body.targetLanguage || 'en';

      console.log('Fetching video from blob:', videoUrl);

      // Fetch the video from blob storage
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to fetch video from blob storage');
      }

      const videoBlob = await videoResponse.blob();
      const fileName = videoUrl.split('/').pop() || 'video.mp4';
      videoFile = new File([videoBlob], fileName, { type: videoBlob.type || 'video/mp4' });

      console.log('Video fetched from blob:', {
        size: videoFile.size,
        type: videoFile.type,
        name: videoFile.name
      });
    } else {
      // Handle direct FormData upload (backward compatibility)
      console.log('Handling direct FormData upload...');
      const formData = await request.formData();
      videoFile = formData.get('video') as File;
      targetLanguage = (formData.get('targetLanguage') as string) || 'en';

      if (!videoFile) {
        console.error('No video file in form data');
        return NextResponse.json(
          { error: 'No video file provided' },
          { status: 400 }
        );
      }

      console.log('Video file details:', {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type
      });
    }

    // Analyze voice characteristics
    console.log('Starting Gemini voice analysis...');
    const geminiService = new GeminiService(geminiApiKey);
    const voiceCharacteristics = await geminiService.analyzeVoiceCharacteristics(videoFile);

    console.log('Voice characteristics received:', voiceCharacteristics);

    // Find matching voices
    console.log('Finding matching voices for language:', targetLanguage);
    const voiceMatchingService = new VoiceMatchingService(elevenLabsApiKey);
    const recommendations = await voiceMatchingService.getVoiceRecommendations(
      voiceCharacteristics,
      targetLanguage
    );

    console.log('Recommendations generated:', {
      count: recommendations.recommendedVoices.length,
      topMatch: recommendations.recommendedVoices[0]?.name
    });

    console.log('=== SUCCESS - Returning recommendations ===');
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('=== ERROR in recommend-voices ===');
    console.error('Error type:', error?.constructor.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Full error object:', error);

    // Return detailed error for debugging
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Recommendation failed',
        details: error instanceof Error ? error.stack : 'Unknown error',
        errorType: error?.constructor.name
      },
      { status: 500 }
    );
  }
}
