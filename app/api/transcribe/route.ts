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
    const { videoUrl, sourceLanguage } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No video URL provided' },
        { status: 400 }
      );
    }

    console.log('Fetching video from blob URL:', videoUrl);
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    const videoFile = new File([videoBlob], 'video.mp4', { type: 'video/mp4' });

    const fileSizeMB = videoFile.size / 1024 / 1024;
    console.log('Video file:', videoFile.name, '|', fileSizeMB.toFixed(2), 'MB');

    // Limit file size for Whisper API (25 MB max)
    if (fileSizeMB > 25) {
      return NextResponse.json(
        { error: 'Video file too large. Maximum size is 25MB for transcription.' },
        { status: 400 }
      );
    }

    console.log('Transcribing with OpenAI Whisper...');
    const startTime = Date.now();

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    if (sourceLanguage) {
      formData.append('language', sourceLanguage);
    }

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text();
      throw new Error(`Transcription failed: ${error}`);
    }

    const data = await transcriptionResponse.json();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Transcription Complete in ${duration}s ===`);
    console.log('Detected language:', data.language);
    console.log('Raw transcription:', data.text.substring(0, 150) + '...');

    // Step 2: Format transcript into proper video script
    console.log('Formatting transcript into video script...');
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const scriptPrompt = `You are a professional video script formatter analyzing an advertisement. Convert the following raw transcript into a properly formatted video production script.

CRITICAL REQUIREMENTS FOR SPEAKER IDENTIFICATION (READ THIS CAREFULLY):

1. **COUNT EVERY VOICE CHANGE AS A NEW SPEAKER**:
   - In a conversation, people take turns speaking: A says something → B responds → A replies → B replies
   - EVERY voice change = NEW SPEAKER NUMBER
   - Example: If you hear "Hello" (person 1) then "Hi there" (person 2) then "How are you?" (person 1 again) then "Good!" (person 2 again)
     That's SPEAKER 1, SPEAKER 2, SPEAKER 1, SPEAKER 2 - NOT all SPEAKER 1 or all SPEAKER 2

2. **STRICTLY FOLLOW THESE RULES**:
   - Label speakers as SPEAKER 1, SPEAKER 2, SPEAKER 3, etc. in order of FIRST appearance
   - If someone appears only ONCE in the video saying ONE brief line, they should have EXACTLY ONE line in the script
   - DO NOT give SPEAKER 3 multiple long dialogue blocks if they only say one short thing
   - DO NOT merge different people's dialogue into one speaker
   - Pay attention to conversational back-and-forth - speakers alternate

3. **RED FLAGS - If you see these, you're doing it WRONG**:
   - ❌ SPEAKER 3 has 5+ lines when they only said one thing
   - ❌ SPEAKER 2 is having a conversation with themselves (dialogue without responses)
   - ❌ All dialogue is attributed to just 1-2 speakers when clearly 3+ people are talking
   - ✅ Correct: Each person gets their own speaker number, brief speakers get 1-2 lines max

4. **CAPTURE ALL ON-SCREEN TEXT** (THIS IS CRITICAL):
   - Look for brand names, product names, and logos
   - Call-to-action text (e.g., "TRY NOW", "BUY NOW", "SHOP TODAY")
   - Taglines and slogans (e.g., "CLEAN THE [BRAND] WAY")
   - Product benefits text
   - Website URLs, discount codes, social media handles
   - Price information
   - ANY text overlay that appears on screen
   - Format as: [SUPER: "exact text as shown"]

5. **TITLES/GRAPHICS**:
   - Opening title cards: [TITLE: "text"]
   - Brand lockups and logos: [LOCKUP: Brand Name Logo]
   - Product graphics: [GRAPHIC: description]

6. **SCENE DESCRIPTIONS**:
   - Add context: [SCENE: Product demonstration in bathroom]
   - Note scene changes: [SCENE: Close-up of product]
   - Note character actions: [SCENE: SPEAKER 2 looks frustrated]

7. **TIMING NOTES**:
   - Music cues: [MUSIC: Upbeat background]
   - Sound effects: [SFX: description]
   - Pauses: [PAUSE]

EXAMPLE FORMAT FOR AN AD WITH PROPER SPEAKER ATTRIBUTION:
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

Now format this raw transcript. Remember to:
- Identify ALL speakers - count voice changes carefully, don't group different voices together
- If someone speaks once briefly, give them just ONE line
- Pay attention to dialogue exchanges (he said / she said / he replied)
- Infer on-screen text from context (brand names mentioned, calls-to-action like "try it", product names)
- Add placeholder [SUPER: "text"] where on-screen text would logically appear
- Mark all brand mentions and logos as [LOCKUP: Brand Name]

IMPORTANT: You MUST identify on-screen text from the dialogue context. For example:
- If someone says "Bref", add [LOCKUP: Bref logo] nearby
- If dialogue suggests urgency, add [SUPER: "TRY NOW"] or similar
- Product names mentioned should have [SUPER: "Product Name"]

RAW AUDIO TRANSCRIPT:
${data.text}

Return ONLY the formatted script with ALL speakers CORRECTLY identified (separate every voice change) and inferred supers/lockups included.`;

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

    const formattedScript = scriptResponse.choices[0].message.content || data.text;

    console.log('Script formatted successfully!');
    console.log('Formatted script preview:', formattedScript.substring(0, 200) + '...');

    return NextResponse.json({
      success: true,
      text: formattedScript,
      rawText: data.text,
      language: data.language,
      segments: data.segments || [],
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
