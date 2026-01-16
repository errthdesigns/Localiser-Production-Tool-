import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Transcription ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { videoUrl, sourceLanguage } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No video URL provided' },
        { status: 400 }
      );
    }

    console.log('Transcribing video with OpenAI Whisper...');
    const startTime = Date.now();

    // Step 1: Transcribe with OpenAI Whisper
    console.log('[1/2] Transcribing audio with Whisper...');
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Fetch the video
    const videoResponse = await fetch(videoUrl);
    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to temporary file (Vercel allows /tmp directory)
    const tmpFilename = `video-${Date.now()}.mp4`;
    const tmpPath = path.join('/tmp', tmpFilename);

    console.log('Saving video to temp file:', tmpPath);
    await writeFile(tmpPath, buffer);

    console.log('Transcribing with Whisper...');

    // Use fs.createReadStream - this is what OpenAI expects in Node.js
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath) as any,
      model: 'whisper-1',
      language: sourceLanguage || undefined,
    });

    // Clean up temp file
    await unlink(tmpPath).catch(err => console.warn('Failed to delete temp file:', err));

    const rawTranscript = transcription.text;
    console.log('Transcription complete!');
    console.log('Raw transcript:', rawTranscript.substring(0, 150) + '...');

    // Step 2: Format with GPT-4 (add speaker labels and production markers)
    console.log('[2/2] Formatting script with GPT-4...');

    const scriptPrompt = `You are a professional transcript formatter. Format the following video transcript with speaker labels.

RULES:

1. **SPEAKER DETECTION**: Analyze the dialogue carefully and assign speaker labels (SPEAKER 1, SPEAKER 2, etc.) based on:
   - Conversation flow and turn-taking
   - Distinct speaking styles and tones
   - Questions and responses between different people
   - Clear dialogue exchanges
   - Be conservative - only add a new speaker when the dialogue clearly indicates a different person

2. **FORMAT**: Use clean, simple formatting:
   - Each speaker on their own line
   - Format: "SPEAKER 1: [dialogue]"
   - Keep natural paragraph breaks between different speakers
   - Do NOT add any production markers like [SUPER], [TITLE], [LOCKUP], [SCENE]
   - Do NOT try to infer visual elements - you only have audio
   - Only include the actual spoken words

EXAMPLE FORMAT:

SPEAKER 1:
That's a good product!

SPEAKER 2:
You don't actually think you're a toilet cleaner, do you?

SPEAKER 1:
Unlike you, I immerse myself in crafting character. Called method acting.

SPEAKER 2:
Yeah? Why don't you method act me an espresso, huh?

---

TRANSCRIPT:
${rawTranscript}

Return ONLY the formatted dialogue with speaker labels. NO production markers, NO scene descriptions, NO inferred visual elements.`;

    const scriptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional transcript formatter. Format audio transcripts with accurate speaker labels. Only include spoken dialogue - no visual elements.'
        },
        {
          role: 'user',
          content: scriptPrompt
        }
      ],
      temperature: 0.3,
    });

    const formattedScript = scriptResponse.choices[0].message.content || rawTranscript;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Transcription Complete in ${duration}s ===`);
    console.log('Formatted script preview:', formattedScript.substring(0, 200) + '...');

    return NextResponse.json({
      success: true,
      text: formattedScript,
      rawText: rawTranscript,
      language: sourceLanguage || 'en',
      processingTime: duration,
    });

  } catch (error) {
    console.error('=== ERROR in transcribe ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transcription failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
