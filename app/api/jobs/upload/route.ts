import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createHash } from 'crypto';
import { jobQueries } from '@/lib/db';
import { addDubbingJob } from '@/lib/queue';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetLanguage = formData.get('targetLanguage') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'No target language provided' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit for demo)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      );
    }

    // Compute file hash
    const fileBuffer = await file.arrayBuffer();
    const hash = createHash('sha256');
    hash.update(Buffer.from(fileBuffer));
    const fileHash = hash.digest('hex');

    console.log(`[Upload] File hash: ${fileHash}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Check if we already have a job for this file + target language
    const existingJob = jobQueries.getByHash.get(fileHash, targetLanguage) as any;

    if (existingJob && existingJob.status === 'completed') {
      console.log(`[Upload] Found completed job for this file+language: ${existingJob.id}`);
      return NextResponse.json({
        success: true,
        jobId: existingJob.id,
        fileHash,
        cached: true,
        fileUrl: existingJob.file_url
      });
    }

    // Upload to Vercel Blob
    const filename = `${fileHash}-${file.name}`;
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      addRandomSuffix: false
    });

    console.log(`[Upload] Uploaded to: ${blob.url}`);

    // Create job
    const jobId = randomUUID();
    const now = Date.now();

    jobQueries.create.run(
      jobId,
      fileHash,
      file.name,
      blob.url,
      targetLanguage,
      now,
      now
    );

    console.log(`[Upload] Created job: ${jobId}`);

    // Add to queue
    await addDubbingJob({
      jobId,
      fileHash,
      fileUrl: blob.url,
      originalFilename: file.name,
      targetLanguage,
      enableLipSync: false // Default off for Monday demo
    });

    return NextResponse.json({
      success: true,
      jobId,
      fileHash,
      fileUrl: blob.url,
      cached: false
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
