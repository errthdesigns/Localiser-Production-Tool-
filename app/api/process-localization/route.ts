import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';
import { TranslationService } from '@/lib/services/translation';
import { ElevenLabsService } from '@/lib/services/elevenlabs';
import { HeyGenService } from '@/lib/services/heygen';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for full processing

/**
 * Main orchestration endpoint for video localization workflow
 * Steps:
 * 1. Analyze video with Gemini (visual context, scenes, initial transcription)
 * 2. Translate content with context awareness
 * 3. Generate voice with ElevenLabs
 * 4. Verify quality
 * 5. Return results
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API keys
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const heygenApiKey = process.env.HEYGEN_API_KEY;

    if (!geminiApiKey || !elevenLabsApiKey || !heygenApiKey) {
      return NextResponse.json(
        { error: { message: 'Required API keys not configured (Gemini, ElevenLabs, HeyGen)' } },
        { status: 500 }
      );
    }

    // Parse request
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const targetLanguage = formData.get('targetLanguage') as string;
    const voiceId = formData.get('voiceId') as string;

    if (!videoFile || !targetLanguage || !voiceId) {
      return NextResponse.json(
        { error: { message: 'Missing required parameters' } },
        { status: 400 }
      );
    }

    // Initialize services
    const geminiService = new GeminiService(geminiApiKey);
    const translationService = new TranslationService(geminiApiKey);
    const elevenLabsService = new ElevenLabsService(elevenLabsApiKey);
    const heygenService = new HeyGenService(heygenApiKey);

    // Step 1: Analyze video with Gemini
    console.log('Step 1: Analyzing video...');
    const videoAnalysis = await geminiService.analyzeVideo(videoFile);

    // Step 2: Translate transcript with context
    console.log('Step 2: Translating content...');
    const fullTranscript = videoAnalysis.transcript
      .map(seg => seg.text)
      .join(' ');

    const translation = await translationService.translate(
      {
        text: fullTranscript,
        sourceLanguage: videoAnalysis.audioFeatures.language,
        targetLanguage: targetLanguage,
        preserveTiming: true
      },
      videoAnalysis
    );

    // Step 3: Translate individual segments for better timing
    console.log('Step 3: Translating segments...');
    const segmentTranslations = await translationService.translateSegments(
      videoAnalysis.transcript,
      videoAnalysis.audioFeatures.language,
      targetLanguage,
      videoAnalysis
    );

    // Step 4: Generate voice for each segment
    console.log('Step 4: Generating voice...');
    const audioSegments = await elevenLabsService.generateSegmentedSpeech(
      segmentTranslations.map((trans, idx) => ({
        text: trans.translatedText,
        startTime: videoAnalysis.transcript[idx].startTime,
        endTime: videoAnalysis.transcript[idx].endTime
      })),
      voiceId
    );

    // Step 5: Generate lip-synced video with HeyGen
    console.log('Step 5: Generating lip-synced video with HeyGen...');
    // For now, use the first audio segment (in production, combine all segments)
    const firstAudioBlob = audioSegments[0].audioBlob;

    const heygenVideo = await heygenService.generateLipSyncVideo(
      videoFile,
      firstAudioBlob,
      {
        maxWaitTime: 300000, // 5 minutes
        pollInterval: 5000    // 5 seconds
      }
    );

    // Step 6: Verify translation quality
    console.log('Step 6: Verifying quality...');
    const qualityCheck = await translationService.verifyTranslation(
      fullTranscript,
      translation.translatedText,
      videoAnalysis.audioFeatures.language,
      targetLanguage
    );

    // Calculate overall quality score
    const overallScore = Math.round(
      (qualityCheck.accuracy +
        qualityCheck.fluency +
        qualityCheck.culturalAppropriateness +
        qualityCheck.timingSuitability) / 4
    );

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      data: {
        videoAnalysis: {
          duration: videoAnalysis.transcript[videoAnalysis.transcript.length - 1]?.endTime || 0,
          scenes: videoAnalysis.scenes.length,
          segments: videoAnalysis.transcript.length,
          sourceLanguage: videoAnalysis.audioFeatures.language
        },
        translation: {
          fullText: translation.translatedText,
          segments: segmentTranslations.map((trans, idx) => ({
            original: videoAnalysis.transcript[idx].text,
            translated: trans.translatedText,
            startTime: videoAnalysis.transcript[idx].startTime,
            endTime: videoAnalysis.transcript[idx].endTime
          })),
          targetLanguage: translation.targetLanguage
        },
        audio: {
          segments: audioSegments.length,
          totalDuration: audioSegments.reduce((sum, seg) => sum + seg.duration, 0),
          voiceId
        },
        video: {
          videoId: heygenVideo.videoId,
          videoUrl: heygenVideo.videoUrl,
          status: 'completed',
          message: 'Lip-synced video generated successfully with HeyGen'
        },
        quality: {
          accuracy: qualityCheck.accuracy,
          fluency: qualityCheck.fluency,
          culturalAppropriateness: qualityCheck.culturalAppropriateness,
          timingSuitability: qualityCheck.timingSuitability,
          overallScore,
          approved: overallScore >= 80,
          issues: qualityCheck.issues,
          suggestions: qualityCheck.suggestions
        }
      }
    });

  } catch (error) {
    console.error('Localization processing error:', error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Processing failed',
          details: error instanceof Error ? error.stack : undefined
        }
      },
      { status: 500 }
    );
  }
}
