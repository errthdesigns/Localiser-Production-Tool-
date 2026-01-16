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
    console.log('Transcription:', data.text.substring(0, 150) + '...');

    return NextResponse.json({
      success: true,
      text: data.text,
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
