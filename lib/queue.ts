import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

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

// Lazy connection - only create when needed (not during build)
let _connection: Redis | null = null;
let _dubbingQueue: Queue<DubbingJobData> | null = null;
let _dubbingQueueEvents: QueueEvents | null = null;

export function getConnection(): Redis {
  if (!_connection) {
    _connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null
    });
  }
  return _connection;
}

export function getDubbingQueue(): Queue<DubbingJobData> {
  if (!_dubbingQueue) {
    _dubbingQueue = new Queue<DubbingJobData>('dubbing', {
      connection: getConnection(),
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
  }
  return _dubbingQueue;
}

export function getDubbingQueueEvents(): QueueEvents {
  if (!_dubbingQueueEvents) {
    _dubbingQueueEvents = new QueueEvents('dubbing', { connection: getConnection() });
  }
  return _dubbingQueueEvents;
}

// Helper to add job to queue
export async function addDubbingJob(data: DubbingJobData) {
  const queue = getDubbingQueue();
  const job = await queue.add('process-dubbing', data, {
    jobId: data.jobId
  });

  console.log(`[Queue] Added dubbing job ${job.id}`);
  return job;
}

// Helper to get job status
export async function getJobStatus(jobId: string) {
  const queue = getDubbingQueue();
  const job = await queue.getJob(jobId);

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
