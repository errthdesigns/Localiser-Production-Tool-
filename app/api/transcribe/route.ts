import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for transcription

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Transcription with AssemblyAI ===');

    const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!assemblyaiApiKey) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
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

    console.log('Transcribing video with AssemblyAI (professional speaker diarization)...');
    const startTime = Date.now();

    // Initialize AssemblyAI client
    const client = new AssemblyAI({
      apiKey: assemblyaiApiKey,
    });

    console.log('Submitting transcription job with speaker diarization...');

    // Submit transcription with speaker diarization
    const transcript = await client.transcripts.transcribe({
      audio: videoUrl,
      speaker_labels: true, // Enable speaker diarization
      language_code: sourceLanguage || 'en',
    });

    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Transcription Complete in ${duration}s ===`);

    // Format the transcript with speaker labels
    let formattedScript = '';
    let currentSpeaker = '';
    let currentText = '';

    if (transcript.utterances && transcript.utterances.length > 0) {
      console.log('Processing', transcript.utterances.length, 'utterances');

      for (const utterance of transcript.utterances) {
        const speaker = `SPEAKER ${utterance.speaker}`;

        if (speaker !== currentSpeaker) {
          // New speaker - flush previous speaker's text
          if (currentText.trim()) {
            formattedScript += `${currentSpeaker}:\n${currentText.trim()}\n\n`;
          }
          currentSpeaker = speaker;
          currentText = utterance.text + ' ';
        } else {
          // Same speaker - accumulate text
          currentText += utterance.text + ' ';
        }
      }

      // Flush final speaker
      if (currentText.trim()) {
        formattedScript += `${currentSpeaker}:\n${currentText.trim()}\n`;
      }
    } else {
      // Fallback to words if no utterances
      formattedScript = transcript.text || '';
    }

    console.log('Transcript preview:', formattedScript.substring(0, 200) + '...');

    return NextResponse.json({
      success: true,
      text: formattedScript,
      rawText: transcript.text || '',
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
