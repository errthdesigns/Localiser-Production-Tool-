import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Get ffmpeg path - will be bundled by Vercel
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Translation and Dubbing ===');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!openaiApiKey || !elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { transcript, translatedText: providedTranslation, sourceLanguage, targetLanguage, videoUrl } = body;

    if (!transcript || !targetLanguage) {
      return NextResponse.json(
        { error: 'Transcript and target language are required' },
        { status: 400 }
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required for dubbing' },
        { status: 400 }
      );
    }

    console.log('Source language:', sourceLanguage);
    console.log('Target language:', targetLanguage);
    console.log('Transcript length:', transcript.length, 'characters');
    console.log('Video URL:', videoUrl);
    console.log('Pre-translated text provided:', !!providedTranslation);

    const startTime = Date.now();
    let translatedText: string;

    // Step 1: Translate with GPT-4 (or use provided translation)
    if (providedTranslation) {
      console.log('[1/4] Using provided translation (skipping GPT-4 translation)...');
      translatedText = providedTranslation;
      console.log('Using pre-translated text:', translatedText.substring(0, 150) + '...');
    } else {
      console.log('[1/4] Translating with GPT-4...');

      const openai = new OpenAI({ apiKey: openaiApiKey });

      const languageNames: Record<string, string> = {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        it: 'Italian',
        pt: 'Portuguese',
        ja: 'Japanese',
        ko: 'Korean',
        zh: 'Chinese',
      };

      const translationResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${languageNames[sourceLanguage] || sourceLanguage} to ${languageNames[targetLanguage] || targetLanguage}. Maintain the same tone, style, and natural flow. Only return the translated text, nothing else.`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.3,
      });

      translatedText = translationResponse.choices[0].message.content || transcript;
      console.log('Translation complete!');
      console.log('Translated text:', translatedText.substring(0, 150) + '...');
    }

    // Extract only dialogue for TTS - remove speaker labels and production markers
    const dialogueOnly = translatedText
      .split('\n')
      .map((line: string) => {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) return '';

        // Skip production markers like [SUPER:, [TITLE:, etc.
        if (trimmed.startsWith('[')) return '';

        // Remove speaker labels (SPEAKER 1:, SPEAKER 2:, etc.) and keep only dialogue
        const speakerMatch = trimmed.match(/^(SPEAKER [A-Z0-9]+|VOICEOVER|NARRATOR):\s*(.+)$/i);
        if (speakerMatch) {
          return speakerMatch[2]; // Return only the dialogue part after "SPEAKER X:"
        }

        // Skip lines that are JUST speaker labels with no dialogue
        if (trimmed.match(/^(SPEAKER [A-Z0-9]+|VOICEOVER|NARRATOR):?\s*$/i)) {
          return '';
        }

        // Keep any other text (dialogue without labels)
        return trimmed;
      })
      .filter(line => line.length > 0) // Remove empty strings
      .join(' ') // Join with spaces for natural speech flow
      .trim();

    console.log('Dialogue extracted for TTS:', dialogueOnly.substring(0, 150) + '...');
    console.log('Dialogue length:', dialogueOnly.length, 'characters (vs full script:', translatedText.length, 'characters)');

    // Step 2: Generate speech with ElevenLabs
    console.log('[2/4] Generating speech with ElevenLabs...');

    // Use Antoni voice ID (multilingual male voice)
    const voiceId = 'ErXwobaYiN019PkySvjV';

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: dialogueOnly, // Use dialogue-only text for TTS, not the full formatted script
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      throw new Error(`TTS generation failed: ${error}`);
    }

    const audioBlob = await ttsResponse.blob();
    const audioBuffer = await audioBlob.arrayBuffer();

    console.log('TTS complete! Audio size:', audioBuffer.byteLength, 'bytes');

    // Step 3: Download original video
    console.log('[3/4] Downloading original video...');
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video from URL');
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    console.log('Video downloaded:', videoBuffer.byteLength, 'bytes');

    // Step 4: Combine video with dubbed audio using FFmpeg
    console.log('[4/4] Combining video with dubbed audio...');
    console.log('FFmpeg path:', ffmpegPath);

    const timestamp = Date.now();
    const videoPath = path.join('/tmp', `input-${timestamp}.mp4`);
    const audioPath = path.join('/tmp', `audio-${timestamp}.mp3`);
    const outputPath = path.join('/tmp', `output-${timestamp}.mp4`);

    try {
      // Write files to /tmp
      await writeFile(videoPath, Buffer.from(videoBuffer));
      await writeFile(audioPath, Buffer.from(audioBuffer));

      console.log('Running FFmpeg...');
      console.log('Input video:', videoPath, 'exists');
      console.log('Input audio:', audioPath, 'exists');

      // Use FFmpeg to replace audio track
      const command = `"${ffmpegPath}" -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;
      console.log('FFmpeg command:', command);

      const { stdout, stderr } = await execAsync(command);
      console.log('FFmpeg stdout:', stdout);
      if (stderr) console.log('FFmpeg stderr:', stderr);
      console.log('FFmpeg execution complete, output should be at:', outputPath);

      // Read the output video
      const dubbedVideoBuffer = await readFile(outputPath);
      console.log('Dubbed video file read successfully:', dubbedVideoBuffer.length, 'bytes');

      const videoBase64 = dubbedVideoBuffer.toString('base64');
      console.log('Dubbed video base64 encoded:', videoBase64.length, 'characters');

      // Clean up temp files
      await Promise.all([
        unlink(videoPath).catch(() => {}),
        unlink(audioPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
      ]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`=== Translation and Dubbing Complete in ${duration}s ===`);

      return NextResponse.json({
        success: true,
        translatedText,
        videoData: videoBase64, // Return dubbed video
        processingTime: duration,
      });

    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError);

      // Clean up on error
      await Promise.all([
        unlink(videoPath).catch(() => {}),
        unlink(audioPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
      ]);

      throw new Error(`Failed to combine video and audio: ${ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('=== ERROR in translate-and-dub ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Translation and dubbing failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
