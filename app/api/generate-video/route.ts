import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for video processing

export async function POST(request: NextRequest) {
  let videoPath: string | null = null;
  let audioPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const audioFile = formData.get('audio') as File;

    if (!videoFile || !audioFile) {
      return NextResponse.json(
        { error: { message: 'Missing video or audio file' } },
        { status: 400 }
      );
    }

    const tmpDir = '/tmp';
    const videoId = randomUUID();

    // Save uploaded files temporarily
    videoPath = join(tmpDir, `${videoId}-video${getFileExtension(videoFile.name)}`);
    audioPath = join(tmpDir, `${videoId}-audio.mp3`);
    outputPath = join(tmpDir, `${videoId}-output.mp4`);

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    await writeFile(videoPath, videoBuffer);
    await writeFile(audioPath, audioBuffer);

    // Use FFmpeg to replace audio
    // Note: This requires FFmpeg to be installed in the deployment environment
    // Vercel doesn't include FFmpeg by default - you'll need to use a layer or alternative approach
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);

    const ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;

    await execPromise(ffmpegCommand);

    // Read the output file
    const outputBuffer = await import('fs/promises').then(fs => fs.readFile(outputPath));

    // Clean up temporary files
    await Promise.all([
      unlink(videoPath).catch(() => {}),
      unlink(audioPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="localized-video-${videoId}.mp4"`,
        'Content-Length': outputBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    // Clean up on error
    if (videoPath) await unlink(videoPath).catch(() => {});
    if (audioPath) await unlink(audioPath).catch(() => {});
    if (outputPath) await unlink(outputPath).catch(() => {});

    console.error('Video generation error:', error);

    // Check if FFmpeg is missing
    if (error instanceof Error && error.message.includes('ffmpeg')) {
      return NextResponse.json(
        {
          error: {
            message: 'FFmpeg not available. For Vercel deployment, consider using a service like Cloudinary or AWS Lambda with FFmpeg layer.'
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Video generation failed' } },
      { status: 500 }
    );
  }
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? `.${ext}` : '.mp4';
}
