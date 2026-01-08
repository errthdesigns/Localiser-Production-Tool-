export interface VeedLipSyncResponse {
  videoUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class VeedService {
  private apiKey: string;
  private baseUrl = 'https://api.veed.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createLipSync(videoFile: File, audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('audio', audioBlob, 'audio.mp3');

      const response = await fetch(`${this.baseUrl}/lipsync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VEED API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.jobId;
    } catch (error) {
      console.error('VEED lip-sync creation error:', error);
      throw new Error(`Failed to create lip-sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getJobStatus(jobId: string): Promise<VeedLipSyncResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/lipsync/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        videoUrl: data.output_url,
        status: data.status,
        error: data.error,
      };
    } catch (error) {
      console.error('VEED status check error:', error);
      throw new Error(`Failed to check job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async waitForCompletion(
    jobId: string,
    maxWaitTime: number = 300000,
    pollInterval: number = 5000
  ): Promise<VeedLipSyncResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getJobStatus(jobId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Lip-sync failed: ${status.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Lip-sync timeout - exceeded maximum wait time');
  }

  async downloadVideo(videoUrl: string): Promise<Blob> {
    try {
      const response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Video download error:', error);
      throw new Error(`Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateLipSyncVideo(
    videoFile: File,
    audioBlob: Blob,
    options?: {
      maxWaitTime?: number;
      pollInterval?: number;
    }
  ): Promise<{ videoBlob: Blob; videoUrl: string }> {
    try {
      console.log('Creating VEED lip-sync job...');
      const jobId = await this.createLipSync(videoFile, audioBlob);

      console.log('Waiting for lip-sync processing...');
      const result = await this.waitForCompletion(
        jobId,
        options?.maxWaitTime,
        options?.pollInterval
      );

      if (!result.videoUrl) {
        throw new Error('Video completed but no URL returned');
      }

      console.log('Downloading completed video...');
      const videoBlob = await this.downloadVideo(result.videoUrl);

      return {
        videoBlob,
        videoUrl: result.videoUrl,
      };
    } catch (error) {
      console.error('VEED full workflow error:', error);
      throw new Error(`Lip-sync video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default VeedService;
