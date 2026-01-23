import { NextRequest, NextResponse } from 'next/server';
import { transcriptQueries, parseTranscript, jobQueries } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language') || 'auto';

    // Get job to get file hash
    const job = jobQueries.getById.get(jobId) as any;
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get transcript
    const transcript = transcriptQueries.getByHashAndLang.get(job.file_hash, language) as any;

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript: parseTranscript(transcript)
    });

  } catch (error) {
    console.error('[Transcript GET] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get transcript'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    const body = await request.json();
    const { segments, language } = body;

    if (!segments || !language) {
      return NextResponse.json(
        { error: 'Missing segments or language' },
        { status: 400 }
      );
    }

    // Get job
    const job = jobQueries.getById.get(jobId) as any;
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get existing transcript
    const existingTranscript = transcriptQueries.getByHashAndLang.get(job.file_hash, language) as any;

    if (!existingTranscript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Update transcript segments
    const parsed = parseTranscript(existingTranscript);
    parsed.segments = segments;

    // Save updated transcript (create new version)
    transcriptQueries.create.run(
      jobId,
      job.file_hash,
      language,
      JSON.stringify(parsed.speakers),
      JSON.stringify(segments),
      Date.now()
    );

    return NextResponse.json({
      success: true,
      transcript: parsed
    });

  } catch (error) {
    console.error('[Transcript POST] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update transcript'
      },
      { status: 500 }
    );
  }
}
