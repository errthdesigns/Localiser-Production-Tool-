import { VoiceGenerationResult } from '../types';

export interface HeyGenVideoRequest {
  videoUrl?: string;
  videoFile?: File;
  audioUrl?: string;
  audioBlob?: Blob;
  text?: string;
  voiceId?: string;
}

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

  /**
   * Create a video translation job with lip-sync
   */
  async createVideoTranslation(request: HeyGenVideoRequest): Promise<HeyGenVideoResponse> {
    try {
      const formData = new FormData();

      // Add video
      if (request.videoFile) {
        formData.append('video', request.videoFile);
      } else if (request.videoUrl) {
        formData.append('video_url', request.videoUrl);
      } else {
        throw new Error('Either videoFile or videoUrl is required');
      }

      // Add audio or text
      if (request.audioBlob) {
        formData.append('audio', request.audioBlob, 'audio.mp3');
      } else if (request.audioUrl) {
        formData.append('audio_url', request.audioUrl);
      } else if (request.text && request.voiceId) {
        formData.append('text', request.text);
        formData.append('voice_id', request.voiceId);
      } else {
        throw new Error('Either audio or text+voiceId is required');
      }

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

  /**
   * Check the status of a video translation job
   */
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

  /**
   * Wait for video to complete processing (with polling)
   */
  async waitForVideoCompletion(
    videoId: string,
    maxWaitTime: number = 300000, // 5 minutes
    pollInterval: number = 5000 // 5 seconds
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

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Video processing timeout - exceeded maximum wait time');
  }

  /**
   * Download completed video
   */
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

  /**
   * Full workflow: Create, wait, and download
   */
  async generateLipSyncVideo(
    videoFile: File,
    audioBlob: Blob,
    options?: {
      maxWaitTime?: number;
      pollInterval?: number;
    }
  ): Promise<{ videoId: string; videoBlob: Blob; videoUrl: string }> {
    try {
      // Step 1: Create video translation job
      console.log('Creating HeyGen video translation job...');
      const createResult = await this.createVideoTranslation({
        videoFile,
        audioBlob,
      });

      // Step 2: Wait for completion
      console.log('Waiting for video processing...');
      const completedResult = await this.waitForVideoCompletion(
        createResult.videoId,
        options?.maxWaitTime,
        options?.pollInterval
      );

      if (!completedResult.videoUrl) {
        throw new Error('Video completed but no URL returned');
      }

      // Step 3: Download video
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

  /**
   * Get available voices (if HeyGen provides this endpoint)
   */
  async getVoices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || data.data?.voices || [];
    } catch (error) {
      console.error('Error fetching HeyGen voices:', error);
      // Return empty array if endpoint doesn't exist
      return [];
    }
  }
}

export default HeyGenService;
