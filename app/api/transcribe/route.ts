import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Transcription with Speaker Diarization ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!openaiApiKey || !assemblyaiApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
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

    console.log('Transcribing video with AssemblyAI (with speaker diarization)...');
    const startTime = Date.now();

    // Step 1: Submit transcription job to AssemblyAI
    console.log('[1/3] Submitting transcription job...');
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyaiApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: videoUrl,
        speaker_labels: true, // Enable speaker diarization
        language_code: sourceLanguage || 'en', // Default to English if not specified
      }),
    });

    if (!transcriptResponse.ok) {
      const error = await transcriptResponse.text();
      throw new Error(`Failed to submit transcription: ${error}`);
    }

    const { id: transcriptId } = await transcriptResponse.json();
    console.log('Transcription job submitted:', transcriptId);

    // Step 2: Poll for completion
    console.log('[2/3] Polling for transcription completion...');
    let transcript;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (120 * 5 seconds)

    while (attempts < maxAttempts) {
      const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': assemblyaiApiKey },
      });

      transcript = await pollingResponse.json();
      console.log(`Polling attempt ${attempts + 1}: status = ${transcript.status}`);

      if (transcript.status === 'completed') {
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    if (transcript.status !== 'completed') {
      throw new Error('Transcription timed out after 10 minutes');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Transcription Complete in ${duration}s ===`);
    console.log('Detected language:', transcript.language_code);
    console.log('Number of speakers detected:', new Set(transcript.utterances?.map((u: any) => u.speaker)).size);
    console.log('Number of utterances:', transcript.utterances?.length);

    // Step 3: Format utterances into basic script with speaker labels
    console.log('[3/3] Formatting transcript with speaker labels...');

    // Create speaker mapping: A -> SPEAKER 1, B -> SPEAKER 2, etc.
    const utterances = transcript.utterances || [];
    const speakerMap = new Map<string, number>();
    let speakerCount = 0;

    // Build basic transcript with accurate speaker labels from AssemblyAI
    let basicTranscript = '';
    for (const utterance of utterances) {
      const speakerLabel = utterance.speaker;

      // Assign speaker number in order of first appearance
      if (!speakerMap.has(speakerLabel)) {
        speakerCount++;
        speakerMap.set(speakerLabel, speakerCount);
      }

      const speakerNumber = speakerMap.get(speakerLabel);
      basicTranscript += `SPEAKER ${speakerNumber}: ${utterance.text}\n`;
    }

    console.log('Basic transcript with speaker labels:');
    console.log(basicTranscript.substring(0, 300) + '...');

    // Step 4: Use GPT-4 to add production elements (SUPERs, TITLEs, LOCKUPs, etc.)
    console.log('Adding production elements with GPT-4...');
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const scriptPrompt = `You are a professional video script formatter. The transcript below already has CORRECT speaker labels from AI voice analysis. Your job is to add production elements (SUPER, TITLE, LOCKUP, SCENE markers) while keeping the speaker labels EXACTLY as they are.

CRITICAL RULES:

1. **DO NOT CHANGE SPEAKER LABELS**:
   - The speaker labels (SPEAKER 1:, SPEAKER 2:, etc.) are ALREADY CORRECT from voice analysis
   - KEEP them exactly as they are - do NOT merge, split, or renumber speakers
   - KEEP the exact same dialogue text for each speaker
   - Only add production markers between or around the speaker lines

2. **YOUR JOB: Add production elements**:
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

IMPORTANT REMINDERS:
- DO NOT change the speaker numbers or assignments - they are already correct!
- KEEP all dialogue text exactly as written
- ONLY add production markers ([SUPER], [TITLE], [LOCKUP], [SCENE], etc.)
- Infer on-screen text from context (brand names mentioned, calls-to-action like "try it", product names)
- Add placeholder [SUPER: "text"] where on-screen text would logically appear
- Mark all brand mentions and logos as [LOCKUP: Brand Name]

For example:
- If someone says "Bref", add [LOCKUP: Bref logo] nearby
- If dialogue suggests urgency, add [SUPER: "TRY NOW"] or similar
- Product names mentioned should have [SUPER: "Product Name"]

TRANSCRIPT WITH CORRECT SPEAKER LABELS (from voice analysis):
${basicTranscript}

Return ONLY the formatted script with production markers added. Keep speaker labels EXACTLY as provided above.`;

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

    const formattedScript = scriptResponse.choices[0].message.content || basicTranscript;

    console.log('Script formatted successfully!');
    console.log('Formatted script preview:', formattedScript.substring(0, 200) + '...');

    return NextResponse.json({
      success: true,
      text: formattedScript,
      rawText: transcript.text,
      language: transcript.language_code?.substring(0, 2) || 'en', // Convert 'en_us' to 'en'
      speakerCount: speakerCount,
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
