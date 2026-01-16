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

    const prompt = `You are a professional video transcriber with visual speaker detection capabilities. Watch this video VERY CAREFULLY and create an accurate transcript with proper speaker attribution.

CRITICAL INSTRUCTIONS FOR ACCURACY:

1. **VISUAL SPEAKER DETECTION**:
   - Watch the video frame-by-frame
   - Identify EXACTLY who is speaking by observing:
     * Mouth movements and lip sync
     * Face visibility and position
     * Body language and gestures
   - Only change speaker labels when you VISUALLY CONFIRM a different person is speaking
   - If multiple people speak, assign them as SPEAKER 1, SPEAKER 2, SPEAKER 3, etc. in order of first appearance

2. **TRANSCRIPTION ACCURACY**:
   - Listen carefully and transcribe EXACTLY what is spoken
   - Do NOT guess or paraphrase - use the actual words
   - Keep complete sentences together - do NOT break them up
   - Keep all of one speaker's continuous dialogue together before switching speakers
   - Maintain natural conversation flow

3. **SPEAKER ATTRIBUTION RULES**:
   - SPEAKER 1: The first person who speaks in the video
   - SPEAKER 2: The second person who speaks in the video
   - SPEAKER 3: The third person who speaks (if present)
   - Use consistent labels throughout - don't renumber speakers
   - Group continuous dialogue from the same speaker together

4. **OUTPUT FORMAT**:
   - Use this exact format:

   SPEAKER 1:
   [Their complete dialogue here, can be multiple sentences]

   SPEAKER 2:
   [Their complete dialogue here, can be multiple sentences]

   SPEAKER 1:
   [Their next dialogue when they speak again]

5. **WHAT TO AVOID**:
   - Do NOT split up one person's continuous speech into multiple sections
   - Do NOT mix dialogue from different speakers together
   - Do NOT add [SUPER], [TITLE], [LOCKUP] or any production markers
   - Do NOT guess at words you can't hear clearly - transcribe accurately

EXAMPLE OF CORRECT FORMAT:

SPEAKER 1:
That's a good product!

SPEAKER 2:
Oh! Oh! I'm obsolete! I'm obsolete! Nice work, Metal Man! Metal Man.

SPEAKER 1:
Did you see that breath? This thing cleans toilets faster than I can process data. It's gonna replace me!

SPEAKER 3:
It's an ad, man. It's an ad. Make-believe.

---

Now watch the video carefully and create an accurate transcript with proper visual speaker attribution.`;

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
