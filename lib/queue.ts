import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

// Job data interfaces
export interface DubbingJobData {
  jobId: string;
  fileHash: string;
  fileUrl: string;
  originalFilename: string;
  targetLanguage: string;
  enableLipSync?: boolean;
}

export interface JobProgress {
  stage: string;
  progress: number;
  message?: string;
}

// Create queues
export const dubbingQueue = new Queue<DubbingJobData>('dubbing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      age: 3600 * 24 * 7 // Keep completed jobs for 7 days
    },
    removeOnFail: {
      age: 3600 * 24 * 7
    }
  }
});

// Queue events for progress tracking
export const dubbingQueueEvents = new QueueEvents('dubbing', { connection });

// Helper to add job to queue
export async function addDubbingJob(data: DubbingJobData) {
  const job = await dubbingQueue.add('process-dubbing', data, {
    jobId: data.jobId
  });

  console.log(`[Queue] Added dubbing job ${job.id}`);
  return job;
}

// Helper to get job status
export async function getJobStatus(jobId: string) {
  const job = await dubbingQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress as JobProgress | number;

  return {
    id: job.id,
    state,
    progress: typeof progress === 'number' ? progress : progress?.progress || 0,
    stage: typeof progress === 'object' ? progress.stage : undefined,
    message: typeof progress === 'object' ? progress.message : undefined,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason
  };
}

export { connection };
