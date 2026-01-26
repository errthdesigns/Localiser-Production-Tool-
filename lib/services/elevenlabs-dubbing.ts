export interface DubbingJob {
  dubbing_id: string;
  name: string;
  status: 'pending' | 'preparing' | 'dubbing' | 'dubbed' | 'failed';
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

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description?: string;
  category?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface VoicesResponse {
  voices: ElevenLabsVoice[];
  has_more: boolean;
  next_page_token?: string;
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
    options?: {
      numSpeakers?: number;
      disableVoiceCloning?: boolean;
      dropBackgroundAudio?: boolean;
      highestResolution?: boolean;
      dubbingStudio?: boolean;
    }
  ): Promise<DubbingJob> {
    try {
      console.log('Creating ElevenLabs dubbing job...');
      console.log('Options:', {
        disableVoiceCloning: options?.disableVoiceCloning || false,
        dropBackgroundAudio: options?.dropBackgroundAudio || false,
        highestResolution: options?.highestResolution || false,
        dubbingStudio: options?.dubbingStudio || false,
      });

      const formData = new FormData();
      formData.append('file', videoFile);
      formData.append('target_lang', targetLanguage);

      if (sourceLanguage) {
        formData.append('source_lang', sourceLanguage);
      }

      if (options?.numSpeakers) {
        formData.append('num_speakers', options.numSpeakers.toString());
      }

      // Voice cloning control
      if (options?.disableVoiceCloning) {
        formData.append('disable_voice_cloning', 'true');
        console.log('✓ Voice cloning disabled - will use Voice Library');
      }

      // Background audio control (keep background music/sound effects by default)
      if (options?.dropBackgroundAudio) {
        formData.append('drop_background_audio', 'true');
        console.log('✓ Background audio will be removed');
      } else {
        console.log('✓ Background audio/music will be preserved');
      }

      // Dubbing Studio mode - enables transcript/translation editing
      if (options?.dubbingStudio) {
        formData.append('dubbing_studio', 'true');
        console.log('✓ Dubbing Studio mode enabled - transcript/translation editing available');
      }

      // Quality settings
      formData.append('watermark', 'false');

      if (options?.highestResolution) {
        formData.append('highest_resolution', 'true');
      }

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
      console.log(`[ElevenLabs API] Fetching status for dubbing ID: ${dubbingId}`);

      const response = await fetch(`${this.baseUrl}/dubbing/${dubbingId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[ElevenLabs API] Status check failed:`, error);
        throw new Error(`Failed to get dubbing status: ${JSON.stringify(error)}`);
      }

      const result = await response.json() as DubbingJob;
      console.log(`[ElevenLabs API] Raw status response:`, result);

      return result;
    } catch (error) {
      console.error('[ElevenLabs API] Failed to get dubbing status:', error);
      throw error;
    }
  }

  /**
   * Download the dubbed audio (MP3 format)
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
        throw new Error(`Failed to download dubbed audio: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to download dubbed audio:', error);
      throw error;
    }
  }

  /**
   * Get list of available voices from ElevenLabs Voice Library
   */
  async getAvailableVoices(pageSize: number = 100): Promise<ElevenLabsVoice[]> {
    try {
      console.log('Fetching available ElevenLabs voices...');

      const response = await fetch(
        `https://api.elevenlabs.io/v2/voices?page_size=${pageSize}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch voices: ${JSON.stringify(error)}`);
      }

      const data = await response.json() as VoicesResponse;
      console.log(`✓ Found ${data.voices.length} voices`);

      return data.voices;
    } catch (error) {
      console.error('Failed to get available voices:', error);
      throw error;
    }
  }

  /**
   * Get transcript for a dubbing job in JSON format
   * Uses new endpoint: GET /v1/dubbing/{dubbing_id}/transcripts/{language_code}/format/json
   */
  async getTranscript(dubbingId: string, languageCode: string): Promise<any> {
    try {
      console.log(`Fetching transcript for dubbing ${dubbingId}, language: ${languageCode}...`);

      const response = await fetch(
        `${this.baseUrl}/dubbing/${dubbingId}/transcripts/${languageCode}/format/json`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch transcript: ${response.statusText}`);
      }

      const transcript = await response.json();
      console.log(`✓ Transcript fetched successfully`);

      return transcript;
    } catch (error) {
      console.error('Failed to get transcript:', error);
      throw error;
    }
  }

  /**
   * Get transcript in SRT format (for display/editing)
   */
  async getTranscriptSRT(dubbingId: string, languageCode: string): Promise<string> {
    try {
      console.log(`Fetching SRT transcript for dubbing ${dubbingId}, language: ${languageCode}...`);

      const response = await fetch(
        `${this.baseUrl}/dubbing/${dubbingId}/transcripts/${languageCode}/format/srt`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch SRT transcript: ${response.statusText}`);
      }

      const srtText = await response.text();
      console.log(`✓ SRT transcript fetched successfully`);

      return srtText;
    } catch (error) {
      console.error('Failed to get SRT transcript:', error);
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
   * Complete dubbing workflow: create job, wait for completion, download audio
   */
  async dubVideo(
    videoFile: File,
    targetLanguage: string,
    sourceLanguage?: string,
    options?: {
      numSpeakers?: number;
      disableVoiceCloning?: boolean;
      dropBackgroundAudio?: boolean;
      highestResolution?: boolean;
      dubbingStudio?: boolean;
    }
  ): Promise<{ dubbingId: string; videoBlob: Blob }> {
    try {
      // Create dubbing job
      const job = await this.createDubbingJob(videoFile, targetLanguage, sourceLanguage, options);

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
