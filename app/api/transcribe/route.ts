import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
    const { videoUrl, sourceLanguage, speakerCount = 0 } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No video URL provided' },
        { status: 400 }
      );
    }

    console.log('Speaker count:', speakerCount === 0 ? 'auto-detect' : speakerCount);

    console.log('Transcribing video with OpenAI Whisper...');
    const startTime = Date.now();

    // Step 1: Transcribe with OpenAI Whisper
    console.log('[1/2] Transcribing audio with Whisper...');
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Fetch the video and convert to a File object with proper name
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();

    // OpenAI requires a File object with a name property
    // Extract filename from URL or use default
    const urlParts = videoUrl.split('/');
    const filename = urlParts[urlParts.length - 1] || 'video.mp4';

    // Create a File object from the blob
    const videoFile = new File([videoBlob], filename, { type: videoBlob.type });

    const transcription = await openai.audio.transcriptions.create({
      file: videoFile,
      model: 'whisper-1',
      language: sourceLanguage || undefined,
    });

    const rawTranscript = transcription.text;
    console.log('Transcription complete!');
    console.log('Raw transcript:', rawTranscript.substring(0, 150) + '...');

    // Step 2: Format with GPT-4 (add speaker labels and production markers)
    console.log('[2/2] Formatting script with GPT-4...');

    // Build speaker instruction based on speakerCount
    const speakerInstruction = speakerCount > 0
      ? `**CRITICAL**: This video has EXACTLY ${speakerCount} speaker${speakerCount > 1 ? 's' : ''}. You MUST use exactly ${speakerCount} speaker label${speakerCount > 1 ? 's' : ''} (${Array.from({length: speakerCount}, (_, i) => `SPEAKER ${i + 1}`).join(', ')}). Do not use more or fewer speakers.`
      : `**BE CONSERVATIVE**: Only create new speaker labels when absolutely necessary. Default to fewer speakers unless dialogue clearly indicates different people (e.g., back-and-forth conversation, distinct roles, questions and answers between different people).`;

    const scriptPrompt = `You are a professional video script formatter. Format the following video transcript into a production-ready script with:

1. **SPEAKER LABELS**: ${speakerInstruction}

   Analyze the dialogue and assign speaker labels (SPEAKER 1, SPEAKER 2, etc.) based on:
   - Conversation flow and turn-taking
   - Distinct speaking styles and tones
   - Questions and responses between different people
   - Role identifiers in dialogue
   - Changes in speaking pace or tone that indicate a different person

2. **PRODUCTION MARKERS**:
   - Add [TITLE: "text"] for opening title cards
   - Add [SUPER: "text"] for on-screen text overlays (infer from dialogue context)
   - Add [LOCKUP: Brand Name] for logos and brand elements
   - Add [SCENE: description] for scene changes or context
   - Add [PAUSE], [MUSIC], [SFX: description] where appropriate

3. **CAPTURE ALL ON-SCREEN TEXT** (THIS IS CRITICAL):
   - Look for brand names, product names, and logos
   - Call-to-action text (e.g., "TRY NOW", "BUY NOW", "SHOP TODAY")
   - Taglines and slogans (e.g., "CLEAN THE [BRAND] WAY")
   - Product benefits text
   - Website URLs, discount codes, social media handles
   - Price information
   - ANY text overlay that appears on screen
   - Format as: [SUPER: "exact text as shown"]

4. **TITLES/GRAPHICS**:
   - Opening title cards: [TITLE: "text"]
   - Brand lockups and logos: [LOCKUP: Brand Name Logo]
   - Product graphics: [GRAPHIC: description]

5. **SCENE DESCRIPTIONS**:
   - Add context: [SCENE: Product demonstration in bathroom]
   - Note scene changes: [SCENE: Close-up of product]
   - Note character actions: [SCENE: SPEAKER 2 looks frustrated]

6. **TIMING NOTES**:
   - Music cues: [MUSIC: Upbeat background]
   - Sound effects: [SFX: description]
   - Pauses: [PAUSE]

EXAMPLE FORMAT:
[TITLE: "Bref Power Active"]

[SCENE: Bathroom, two people enter]

SPEAKER 1:
That's a good product!

[SUPER: "TRY NOW"]

SPEAKER 2:
You don't actually think you're a toilet cleaner, do you?

SPEAKER 1:
Unlike you, I immerse myself in crafting character.

[SCENE: Product close-up on toilet]

SPEAKER 3:
It's an ad, man!

[SUPER: "CLEAN THE Bref WAY"]

[LOCKUP: Bref logo]

---

IMPORTANT:
- Infer on-screen text from context (brand names mentioned, calls-to-action like "try it", product names)
- Add placeholder [SUPER: "text"] where on-screen text would logically appear
- Mark all brand mentions and logos as [LOCKUP: Brand Name]

For example:
- If someone says "Bref", add [LOCKUP: Bref logo] nearby
- If dialogue suggests urgency, add [SUPER: "TRY NOW"] or similar
- Product names mentioned should have [SUPER: "Product Name"]

TRANSCRIPT:
${rawTranscript}

Return ONLY the formatted script with speaker labels and production markers.`;

    const scriptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional video script formatter. Format transcripts into production-ready scripts with speaker labels, supers, titles, lockups, and scene descriptions.'
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
