import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Translation Preview ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { transcript, sourceLanguage, targetLanguage } = body;

    if (!transcript || !targetLanguage) {
      return NextResponse.json(
        { error: 'Transcript and target language are required' },
        { status: 400 }
      );
    }

    console.log('Source language:', sourceLanguage);
    console.log('Target language:', targetLanguage);
    console.log('Transcript length:', transcript.length, 'characters');

    const startTime = Date.now();

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
          content: `You are a professional translator. Translate the following video script from ${languageNames[sourceLanguage] || sourceLanguage} to ${languageNames[targetLanguage] || targetLanguage}.

CRITICAL INSTRUCTIONS:
- Maintain ALL formatting including [SUPER: "text"], [LOCKUP: text], [SCENE: text], [PAUSE], etc.
- Keep speaker labels (SPEAKER 1:, SPEAKER 2:, etc.) in English
- Translate ONLY the dialogue and the text inside [SUPER: "..."] and [LOCKUP: ...]
- Maintain the same tone, style, and natural flow
- Preserve all line breaks and structure

EXAMPLE:
Original:
SPEAKER 1:
Hello world!

[SUPER: "Try Now"]

Translated to Spanish:
SPEAKER 1:
¡Hola mundo!

[SUPER: "Prueba Ahora"]`
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      temperature: 0.3,
    });

    const translatedText = translationResponse.choices[0].message.content || transcript;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Translation Preview Complete in ${duration}s ===`);
    console.log('Translated preview:', translatedText.substring(0, 150) + '...');

    return NextResponse.json({
      success: true,
      translatedText,
      processingTime: duration,
    });

  } catch (error) {
    console.error('=== ERROR in translate-preview ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Translation preview failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
