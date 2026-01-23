import { NextRequest, NextResponse } from 'next/server';
import { jobQueries, artifactQueries, parseArtifact } from '@/lib/db';
import { getJobStatus } from '@/lib/queue';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    // Get job from database
    const job = jobQueries.getById.get(jobId) as any;

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get queue status for real-time progress
    const queueStatus = await getJobStatus(jobId);

    // Get artifacts if completed
    let artifacts = null;
    if (job.status === 'completed') {
      const rawArtifacts = artifactQueries.listByJobId.all(jobId) as any[];
      artifacts = rawArtifacts.map(parseArtifact);
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        fileHash: job.file_hash,
        originalFilename: job.original_filename,
        fileUrl: job.file_url,
        targetLanguage: job.target_language,
        status: job.status,
        progress: job.progress,
        currentStage: job.current_stage,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at
      },
      queueStatus: queueStatus ? {
        state: queueStatus.state,
        progress: queueStatus.progress,
        stage: queueStatus.stage,
        message: queueStatus.message
      } : null,
      artifacts
    });

  } catch (error) {
    console.error('[Status] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Status check failed'
      },
      { status: 500 }
    );
  }
}
