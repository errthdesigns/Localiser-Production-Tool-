import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Script Formatting ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { rawTranscript, videoContext } = body;

    if (!rawTranscript) {
      return NextResponse.json(
        { error: 'Raw transcript is required' },
        { status: 400 }
      );
    }

    console.log('Formatting transcript into video script...');
    console.log('Raw transcript length:', rawTranscript.length, 'characters');

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const scriptPrompt = `You are a professional video script formatter. Convert the following raw transcript into a properly formatted video production script.

FORMAT REQUIREMENTS:
1. **SPEAKER LABELS**: Identify different speakers as SPEAKER 1, SPEAKER 2, etc., or use character names if identifiable (VOICEOVER, NARRATOR, etc.)
2. **ON-SCREEN TEXT**: Mark any text that appears on screen with [SUPER: "text here"]
3. **TITLES/GRAPHICS**: Mark title cards and graphics with [TITLE: "text"] or [GRAPHIC: description]
4. **SCENE DESCRIPTIONS**: Add brief scene descriptions in [BRACKETS] when context changes
5. **TIMING NOTES**: Add timing cues like [PAUSE], [MUSIC], [SFX: description] where relevant

EXAMPLE FORMAT:
[TITLE: "Product Name"]

[SCENE: Product demonstration]

VOICEOVER:
This is the best product you'll ever use.

[SUPER: "Available Now"]

SPEAKER 1:
I can't believe how well this works!

[SFX: Success sound]

[GRAPHIC: Logo lockup]

---

Now format this raw transcript:

${rawTranscript}

Return ONLY the formatted script, no additional commentary.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional video script formatter. Format transcripts into production-ready scripts with speaker labels, supers, titles, and scene descriptions.'
        },
        {
          role: 'user',
          content: scriptPrompt
        }
      ],
      temperature: 0.3,
    });

    const formattedScript = response.choices[0].message.content || rawTranscript;

    console.log('=== Script Formatting Complete ===');
    console.log('Formatted script length:', formattedScript.length, 'characters');

    return NextResponse.json({
      success: true,
      formattedScript,
      originalLength: rawTranscript.length,
      formattedLength: formattedScript.length,
    });

  } catch (error) {
    console.error('=== ERROR in format-script ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Script formatting failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
