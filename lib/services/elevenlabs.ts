import { VoiceGenerationRequest, VoiceGenerationResult, VoiceSettings } from '../types';

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate speech from text
   */
  async generateSpeech(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    try {
      const { text, voiceId, language, settings } = request;

      const defaultSettings: VoiceSettings = {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.5,
        useSpeakerBoost: true
      };

      const voiceSettings = { ...defaultSettings, ...settings };

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarityBoost,
            style: voiceSettings.style,
            use_speaker_boost: voiceSettings.useSpeakerBoost
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.statusText} - ${errorText}`);
      }

      const audioBlob = await response.blob();

      // Estimate duration (rough approximation based on text length and speech rate)
      // Average speech rate: ~150 words per minute
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = (wordCount / 150) * 60;

      return {
        audioBlob,
        duration: estimatedDuration,
        voiceId
      };
    } catch (error) {
      console.error('ElevenLabs speech generation error:', error);
      throw new Error(`Speech generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available voices for a language
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string; labels: any; preview_url?: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices;
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw new Error(`Failed to get voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate speech for multiple segments with timing
   */
  async generateSegmentedSpeech(
    segments: Array<{ text: string; startTime: number; endTime: number }>,
    voiceId: string,
    settings?: VoiceSettings
  ): Promise<VoiceGenerationResult[]> {
    try {
      const results = await Promise.all(
        segments.map(async (segment) => {
          const targetDuration = segment.endTime - segment.startTime;

          // Adjust settings based on target duration
          const adjustedSettings = this.adjustSettingsForTiming(settings || {
            stability: 0.5,
            similarityBoost: 0.75,
            style: 0.5,
            useSpeakerBoost: true
          }, segment.text, targetDuration);

          return this.generateSpeech({
            text: segment.text,
            voiceId,
            language: 'auto', // ElevenLabs auto-detects
            settings: adjustedSettings
          });
        })
      );

      return results;
    } catch (error) {
      console.error('Segmented speech generation error:', error);
      throw new Error(`Segmented speech generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Adjust voice settings to match target timing
   */
  private adjustSettingsForTiming(
    settings: VoiceSettings,
    text: string,
    targetDuration: number
  ): VoiceSettings {
    // Calculate words per minute needed
    const wordCount = text.split(/\s+/).length;
    const targetWPM = (wordCount / targetDuration) * 60;

    // Adjust stability based on speed requirements
    // Faster speech (>180 WPM) needs higher stability
    // Slower speech (<120 WPM) can have lower stability
    let adjustedStability = settings.stability;
    if (targetWPM > 180) {
      adjustedStability = Math.min(0.8, settings.stability + 0.2);
    } else if (targetWPM < 120) {
      adjustedStability = Math.max(0.3, settings.stability - 0.2);
    }

    return {
      ...settings,
      stability: adjustedStability
    };
  }

  /**
   * Combine audio segments into single file (client-side processing)
   */
  async combineAudioSegments(segments: Blob[]): Promise<Blob> {
    // This is a placeholder - actual implementation would require audio processing
    // In practice, you might use Web Audio API or send to a backend service
    throw new Error('Audio segment combination not implemented - use backend service');
  }
}

export default ElevenLabsService;
