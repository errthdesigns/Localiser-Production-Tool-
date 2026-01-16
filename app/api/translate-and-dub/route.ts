import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Translation and Dubbing ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!openaiApiKey || !elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { transcript, translatedText: providedTranslation, sourceLanguage, targetLanguage, videoUrl } = body;

    if (!transcript || !targetLanguage) {
      return NextResponse.json(
        { error: 'Transcript and target language are required' },
        { status: 400 }
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required for dubbing' },
        { status: 400 }
      );
    }

    console.log('Source language:', sourceLanguage);
    console.log('Target language:', targetLanguage);
    console.log('Transcript length:', transcript.length, 'characters');
    console.log('Video URL:', videoUrl);
    console.log('Pre-translated text provided:', !!providedTranslation);

    const startTime = Date.now();
    let translatedText: string;

    // Step 1: Translate with GPT-4 (or use provided translation)
    if (providedTranslation) {
      console.log('[1/4] Using provided translation (skipping GPT-4 translation)...');
      translatedText = providedTranslation;
      console.log('Using pre-translated text:', translatedText.substring(0, 150) + '...');
    } else {
      console.log('[1/4] Translating with GPT-4...');

      const openai = new OpenAI({ apiKey: openaiApiKey });

      const languageNames: Record<string, string> = {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        it: 'Italian',
        pt: 'Portuguese',
        ja: 'Japanese',
        ko: 'Korean',
        zh: 'Chinese',
      };

      const translationResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${languageNames[sourceLanguage] || sourceLanguage} to ${languageNames[targetLanguage] || targetLanguage}. Maintain the same tone, style, and natural flow. Only return the translated text, nothing else.`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.3,
      });

      translatedText = translationResponse.choices[0].message.content || transcript;
      console.log('Translation complete!');
      console.log('Translated text:', translatedText.substring(0, 150) + '...');
    }

    // Extract only dialogue for TTS - remove speaker labels and production markers
    const dialogueOnly = translatedText
      .split('\n')
      .map((line: string) => {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) return '';

        // Skip production markers like [SUPER:, [TITLE:, etc.
        if (trimmed.startsWith('[')) return '';

        // Remove speaker labels (SPEAKER 1:, SPEAKER 2:, etc.) and keep only dialogue
        const speakerMatch = trimmed.match(/^(SPEAKER [A-Z0-9]+|VOICEOVER|NARRATOR):\s*(.+)$/i);
        if (speakerMatch) {
          return speakerMatch[2]; // Return only the dialogue part after "SPEAKER X:"
        }

        // Skip lines that are JUST speaker labels with no dialogue
        if (trimmed.match(/^(SPEAKER [A-Z0-9]+|VOICEOVER|NARRATOR):?\s*$/i)) {
          return '';
        }

        // Keep any other text (dialogue without labels)
        return trimmed;
      })
      .filter(line => line.length > 0) // Remove empty strings
      .join(' ') // Join with spaces for natural speech flow
      .trim();

    console.log('Dialogue extracted for TTS:', dialogueOnly.substring(0, 150) + '...');
    console.log('Dialogue length:', dialogueOnly.length, 'characters (vs full script:', translatedText.length, 'characters)');

    // Step 2: Generate speech with ElevenLabs
    console.log('[2/4] Generating speech with ElevenLabs...');

    // Use Antoni voice ID (multilingual male voice)
    const voiceId = 'ErXwobaYiN019PkySvjV';

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: dialogueOnly, // Use dialogue-only text for TTS, not the full formatted script
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      throw new Error(`TTS generation failed: ${error}`);
    }

    const audioResponse = await ttsResponse.blob();
    const audioBuffer = await audioResponse.arrayBuffer();

    console.log('TTS complete! Audio size:', audioBuffer.byteLength, 'bytes');

    // Step 3: Upload dubbed audio to Vercel Blob (so Replicate can access it)
    console.log('[3/4] Uploading dubbed audio to Vercel Blob...');
    const timestamp = Date.now();
    const audioBlob = await put(`dubbed-audio-${timestamp}.mp3`, Buffer.from(audioBuffer), {
      access: 'public',
      contentType: 'audio/mpeg',
    });
    console.log('Audio uploaded to:', audioBlob.url);

    // Step 4: Generate lip-synced video using Replicate
    console.log('[4/4] Generating lip-synced video with AI...');
    console.log('Video URL:', videoUrl);
    console.log('Audio URL:', audioBlob.url);

    const lipsyncResponse = await fetch(`${request.nextUrl.origin}/api/lipsync-dub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: videoUrl,
        audioUrl: audioBlob.url,
      }),
    });

    if (!lipsyncResponse.ok) {
      const errorData = await lipsyncResponse.json();
      throw new Error(`Lip-sync failed: ${errorData.error || lipsyncResponse.statusText}`);
    }

    const lipsyncData = await lipsyncResponse.json();
    console.log('Lip-sync complete!');

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Translation and Lip-Sync Dubbing Complete in ${duration}s ===`);

    return NextResponse.json({
      success: true,
      translatedText,
      videoData: lipsyncData.videoData, // Return lip-synced video
      lipsyncedVideoUrl: lipsyncData.lipsyncedVideoUrl,
      processingTime: duration,
    });

  } catch (error) {
    console.error('=== ERROR in translate-and-dub ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Translation and dubbing failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
