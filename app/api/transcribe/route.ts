import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Video Analysis with Gemini ===');

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
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

    console.log('Analyzing video with Gemini 2.0 Flash...');
    const startTime = Date.now();

    // Step 1: Download video
    console.log('[1/2] Downloading video...');
    const videoResponse = await fetch(videoUrl);
    const arrayBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(arrayBuffer).toString('base64');

    console.log('Video downloaded, size:', arrayBuffer.byteLength, 'bytes');

    // Step 2: Analyze with Gemini (video understanding + speaker detection)
    console.log('[2/2] Analyzing video with Gemini for transcription and speaker detection...');

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `Watch this video carefully and transcribe all spoken dialogue with accurate speaker attribution.

CRITICAL INSTRUCTIONS:

1. **WATCH THE VIDEO** - Observe who is speaking at each moment by watching their mouth movements and visual cues
2. **ACCURATE SPEAKER DETECTION** - Assign speakers (SPEAKER 1, SPEAKER 2, etc.) based on VISUAL observation of who is actually talking
3. **TRANSCRIBE ALL DIALOGUE** - Write down everything that is spoken
4. **CLEAN FORMAT** - Use simple formatting:
   - Each speaker on their own line
   - Format: "SPEAKER 1: [dialogue]"
   - Natural paragraph breaks between speakers
   - NO production markers
   - ONLY spoken words

EXAMPLE OUTPUT:

SPEAKER 1:
That's a good product!

SPEAKER 2:
You don't actually think you're a toilet cleaner, do you?

SPEAKER 1:
Unlike you, I immerse myself in crafting character.

Return ONLY the dialogue with accurate speaker labels based on visual observation.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'video/mp4',
          data: videoBase64
        }
      },
      { text: prompt }
    ]);

    const formattedScript = result.response.text();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Video Analysis Complete in ${duration}s ===`);
    console.log('Transcript preview:', formattedScript.substring(0, 200) + '...');

    return NextResponse.json({
      success: true,
      text: formattedScript,
      rawText: formattedScript, // Gemini provides the formatted transcript directly
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
