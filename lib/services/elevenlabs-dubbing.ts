export interface DubbingJob {
  dubbing_id: string;
  name: string;
  status: 'dubbing' | 'dubbed' | 'failed';
  target_languages: string[];
  source_language?: string;
}

export interface DubbingResult {
  dubbing_id: string;
  name: string;
  status: string;
  target_languages: string[];
  dubbed_video_url?: string;
}

export class ElevenLabsDubbingService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a dubbing job for a video file
   */
  async createDubbingJob(
    videoFile: File,
    targetLanguage: string,
    sourceLanguage?: string,
    numSpeakers?: number
  ): Promise<DubbingJob> {
    try {
      console.log('Creating ElevenLabs dubbing job...');

      const formData = new FormData();
      formData.append('file', videoFile);
      formData.append('target_lang', targetLanguage);

      if (sourceLanguage) {
        formData.append('source_lang', sourceLanguage);
      }

      if (numSpeakers) {
        formData.append('num_speakers', numSpeakers.toString());
      }

      // Optional: highest quality settings
      formData.append('watermark', 'false');

      const response = await fetch(`${this.baseUrl}/dubbing`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`ElevenLabs Dubbing API error: ${JSON.stringify(error)}`);
      }

      const result = await response.json() as DubbingJob;
      console.log('Dubbing job created:', result.dubbing_id);

      return result;
    } catch (error) {
      console.error('Failed to create dubbing job:', error);
      throw new Error(`Dubbing job creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the status of a dubbing job
   */
  async getDubbingStatus(dubbingId: string): Promise<DubbingJob> {
    try {
      const response = await fetch(`${this.baseUrl}/dubbing/${dubbingId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get dubbing status: ${JSON.stringify(error)}`);
      }

      return await response.json() as DubbingJob;
    } catch (error) {
      console.error('Failed to get dubbing status:', error);
      throw error;
    }
  }

  /**
   * Download the dubbed video
   */
  async downloadDubbedVideo(dubbingId: string, targetLanguage: string): Promise<Blob> {
    try {
      const response = await fetch(
        `${this.baseUrl}/dubbing/${dubbingId}/audio/${targetLanguage}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download dubbed video: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to download dubbed video:', error);
      throw error;
    }
  }

  /**
   * Poll for dubbing completion
   * Checks status every 5 seconds until complete or failed
   */
  async waitForDubbing(dubbingId: string, maxWaitTime: number = 600000): Promise<DubbingJob> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getDubbingStatus(dubbingId);

      console.log(`Dubbing status: ${status.status}`);

      if (status.status === 'dubbed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error('Dubbing job failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Dubbing job timed out');
  }

  /**
   * Complete dubbing workflow: create job, wait for completion, download video
   */
  async dubVideo(
    videoFile: File,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<{ dubbingId: string; videoBlob: Blob }> {
    try {
      // Create dubbing job
      const job = await this.createDubbingJob(videoFile, targetLanguage, sourceLanguage);

      // Wait for completion
      const completedJob = await this.waitForDubbing(job.dubbing_id);

      // Download result
      const videoBlob = await this.downloadDubbedVideo(job.dubbing_id, targetLanguage);

      return {
        dubbingId: job.dubbing_id,
        videoBlob
      };
    } catch (error) {
      console.error('Complete dubbing workflow failed:', error);
      throw error;
    }
  }
}

export default ElevenLabsDubbingService;
