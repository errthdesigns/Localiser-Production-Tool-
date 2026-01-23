import { NextRequest, NextResponse } from 'next/server';
import { voiceMappingQueries, jobQueries } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    const mappings = voiceMappingQueries.getByJobId.all(jobId) as any[];

    return NextResponse.json({
      success: true,
      mappings
    });

  } catch (error) {
    console.error('[Voice Mappings GET] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get voice mappings'
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
    const { speakerId, speakerName, voiceId, voiceName } = body;

    if (!speakerId || !voiceId) {
      return NextResponse.json(
        { error: 'Missing speakerId or voiceId' },
        { status: 400 }
      );
    }

    // Verify job exists
    const job = jobQueries.getById.get(jobId) as any;
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Upsert voice mapping
    voiceMappingQueries.upsert.run(
      jobId,
      speakerId,
      speakerName || null,
      voiceId,
      voiceName || null,
      Date.now()
    );

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('[Voice Mappings POST] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to set voice mapping'
      },
      { status: 500 }
    );
  }
}
