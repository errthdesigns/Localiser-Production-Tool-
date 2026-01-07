import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'OpenAI API key not configured' } },
        { status: 500 }
      );
    }

    const { text, targetLanguage, sourceLanguage = 'English' } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: { message: 'Missing required fields: text and targetLanguage' } },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in video content localization.
Translate the following ${sourceLanguage} text to ${targetLanguage}.
Maintain the tone, style, and timing suitable for video dubbing.
Keep translations natural and culturally appropriate.
Return ONLY the translated text, no explanations.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    });

    const translation = completion.choices[0].message.content;

    return NextResponse.json({
      translation,
      sourceLanguage,
      targetLanguage,
      model: 'gpt-4o'
    });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Translation failed' } },
      { status: 500 }
    );
  }
}
