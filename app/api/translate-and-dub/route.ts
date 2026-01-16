import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

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
    const { transcript, sourceLanguage, targetLanguage, videoUrl } = body;

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

    // Step 1: Translate with GPT-4
    console.log('[1/4] Translating with GPT-4...');
    const startTime = Date.now();

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

    const translatedText = translationResponse.choices[0].message.content || transcript;

    console.log('Translation complete!');
    console.log('Translated text:', translatedText.substring(0, 150) + '...');

    // Extract only speaker dialogue for TTS (remove production markers)
    // Remove lines that start with [ like [SUPER:, [TITLE:, [LOCKUP:, [SCENE:, etc.
    // Keep only speaker dialogue lines
    const dialogueOnly = translatedText
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Skip empty lines
        if (!trimmed) return false;
        // Skip lines that start with [ (production markers)
        if (trimmed.startsWith('[')) return false;
        // Skip lines that are just speaker labels without dialogue
        if (trimmed.match(/^(SPEAKER \d+|VOICEOVER|NARRATOR):?\s*$/i)) return false;
        // Keep everything else (speaker dialogue)
        return true;
      })
      .join('\n')
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

    // Step 4: Combine video with dubbed audio using ffmpeg
    console.log('[4/4] Combining video with dubbed audio...');

    // Create temporary files
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const videoPath = path.join(tempDir, `input-${timestamp}.mp4`);
    const audioPath = path.join(tempDir, `audio-${timestamp}.mp3`);
    const outputPath = path.join(tempDir, `output-${timestamp}.mp4`);

    tempFiles.push(videoPath, audioPath, outputPath);

    // Write files to disk
    await writeFile(videoPath, Buffer.from(videoBuffer));
    await writeFile(audioPath, Buffer.from(audioBuffer));

    console.log('Temporary files created:');
    console.log('- Video:', videoPath);
    console.log('- Audio:', audioPath);
    console.log('- Output:', outputPath);

    // Use ffmpeg to replace audio track
    // -i input.mp4 -i audio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output.mp4
    const ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;

    console.log('Running ffmpeg command...');
    await execAsync(ffmpegCommand);
    console.log('ffmpeg processing complete!');

    // Read the output video
    const fs = require('fs').promises;
    const dubbedVideoBuffer = await fs.readFile(outputPath);
    const videoBase64 = dubbedVideoBuffer.toString('base64');

    console.log('Dubbed video created:', dubbedVideoBuffer.length, 'bytes');

    // Clean up temp files
    console.log('Cleaning up temporary files...');
    for (const file of tempFiles) {
      try {
        await unlink(file);
      } catch (err) {
        console.warn('Failed to delete temp file:', file, err);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Translation and Dubbing Complete in ${duration}s ===`);

    return NextResponse.json({
      success: true,
      translatedText,
      videoData: videoBase64, // Return dubbed video instead of audio
      processingTime: duration,
    });

  } catch (error) {
    console.error('=== ERROR in translate-and-dub ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Clean up temp files on error
    for (const file of tempFiles) {
      try {
        await unlink(file);
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Translation and dubbing failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
