export interface HeyGenVideoResponse {
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export class HeyGenService {
  private apiKey: string;
  private baseUrl = 'https://api.heygen.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createVideoTranslation(videoFile: File, audioBlob: Blob): Promise<HeyGenVideoResponse> {
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('audio', audioBlob, 'audio.mp3');

      const response = await fetch(`${this.baseUrl}/video/translate`, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HeyGen API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return {
        videoId: data.video_id || data.data?.video_id,
        status: 'pending',
      };
    } catch (error) {
      console.error('HeyGen video creation error:', error);
      throw new Error(`Failed to create video translation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVideoStatus(videoId: string): Promise<HeyGenVideoResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/video/status/${videoId}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HeyGen API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return {
        videoId,
        status: data.status || data.data?.status,
        videoUrl: data.video_url || data.data?.video_url,
        error: data.error,
      };
    } catch (error) {
      console.error('HeyGen status check error:', error);
      throw new Error(`Failed to check video status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async waitForVideoCompletion(
    videoId: string,
    maxWaitTime: number = 300000,
    pollInterval: number = 5000
  ): Promise<HeyGenVideoResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getVideoStatus(videoId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Video processing failed: ${status.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Video processing timeout - exceeded maximum wait time');
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
  ): Promise<{ videoId: string; videoBlob: Blob; videoUrl: string }> {
    try {
      console.log('Creating HeyGen video translation job...');
      const createResult = await this.createVideoTranslation(videoFile, audioBlob);

      console.log('Waiting for video processing...');
      const completedResult = await this.waitForVideoCompletion(
        createResult.videoId,
        options?.maxWaitTime,
        options?.pollInterval
      );

      if (!completedResult.videoUrl) {
        throw new Error('Video completed but no URL returned');
      }

      console.log('Downloading completed video...');
      const videoBlob = await this.downloadVideo(completedResult.videoUrl);

      return {
        videoId: completedResult.videoId,
        videoBlob,
        videoUrl: completedResult.videoUrl,
      };
    } catch (error) {
      console.error('HeyGen full workflow error:', error);
      throw new Error(`Lip-sync video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default HeyGenService;
