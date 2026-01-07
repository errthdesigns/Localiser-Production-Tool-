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

    const { originalText, translatedText, sourceLanguage, targetLanguage } = await request.json();

    if (!originalText || !translatedText || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: { message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional translation quality assessor for video localization.
Evaluate the translation quality on these criteria:
1. **Accuracy** (0-100): How accurate is the meaning?
2. **Fluency** (0-100): How natural does it sound in the target language?
3. **Cultural Appropriateness** (0-100): Is it culturally appropriate?
4. **Timing Suitability** (0-100): Is the length suitable for video dubbing?

Provide a JSON response with:
- accuracy: number (0-100)
- fluency: number (0-100)
- culturalAppropriateness: number (0-100)
- timingSuitability: number (0-100)
- overallScore: number (average of above)
- issues: string[] (list of specific issues found)
- suggestions: string[] (specific improvement suggestions)
- approved: boolean (true if overallScore >= 80)`
        },
        {
          role: 'user',
          content: `Evaluate this translation:

SOURCE (${sourceLanguage}):
${originalText}

TRANSLATION (${targetLanguage}):
${translatedText}

Provide your assessment as JSON.`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const assessment = JSON.parse(completion.choices[0].message.content || '{}');

    return NextResponse.json({
      ...assessment,
      sourceLanguage,
      targetLanguage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Verification failed' } },
      { status: 500 }
    );
  }
}
