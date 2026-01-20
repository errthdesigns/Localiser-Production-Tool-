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
    console.log('Language mode:', sourceLanguage || 'AUTO-DETECT');

    // Submit transcription with speaker diarization
    const transcribeConfig: any = {
      audio: videoUrl,
      speaker_labels: true, // Enable speaker diarization
      language_detection: true, // Enable automatic language detection
    };

    // Only set language_code if explicitly provided, otherwise let AssemblyAI auto-detect
    if (sourceLanguage) {
      transcribeConfig.language_code = sourceLanguage;
      console.log('Using specified language:', sourceLanguage);
    } else {
      // Auto-detect language
      console.log('Auto-detecting language from audio with language_detection=true...');
    }

    const transcript = await client.transcripts.transcribe(transcribeConfig);

    console.log('Transcription status:', transcript.status);
    console.log('Transcription ID:', transcript.id);
    console.log('Audio duration:', transcript.audio_duration, 'seconds');
    console.log('Number of words:', transcript.words?.length || 0);
    console.log('Number of utterances:', transcript.utterances?.length || 0);
    console.log('Detected language:', transcript.language_code);

    if (transcript.status === 'error') {
      console.error('Transcription error:', transcript.error);
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    if (!transcript.text || transcript.text.length < 50) {
      console.warn('WARNING: Transcription is very short!');
      console.warn('Full text:', transcript.text);
      console.warn('This might indicate an issue with the audio file or language detection');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Transcription Complete in ${duration}s ===`);

    // Format the transcript with speaker labels
    let formattedScript = '';
    let currentSpeaker = '';
    let currentText = '';

    console.log('Full raw transcript text:', transcript.text);
    console.log('Transcript text length:', transcript.text?.length || 0);

    if (transcript.utterances && transcript.utterances.length > 0) {
      console.log('Processing', transcript.utterances.length, 'utterances');

      // Log first few utterances for debugging
      console.log('First utterance:', transcript.utterances[0]);
      if (transcript.utterances.length > 1) {
        console.log('Last utterance:', transcript.utterances[transcript.utterances.length - 1]);
      }

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
      // Fallback to raw text if no utterances
      console.log('No utterances found, using raw transcript text');
      formattedScript = transcript.text || '';
    }

    console.log('Formatted script preview:', formattedScript.substring(0, 200) + '...');
    console.log('Formatted script length:', formattedScript.length);
    console.log('Detected language:', transcript.language_code);

    return NextResponse.json({
      success: true,
      text: formattedScript,
      rawText: transcript.text || '',
      language: transcript.language_code || sourceLanguage || 'en', // Use detected language
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
