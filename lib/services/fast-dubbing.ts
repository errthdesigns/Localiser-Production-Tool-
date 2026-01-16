import OpenAI from 'openai';

export interface FastDubbingProgress {
  step: 'extracting' | 'transcribing' | 'translating' | 'generating' | 'merging' | 'complete';
  progress: number; // 0-100
  message: string;
}

export class FastDubbingService {
  private openai: OpenAI;
  private elevenLabsApiKey: string;

  constructor(openaiApiKey: string, elevenLabsApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.elevenLabsApiKey = elevenLabsApiKey;
  }

  /**
   * Extract audio from video file and convert to compatible format
   */
  async extractAudio(videoFile: File): Promise<File> {
    // Convert video to audio using Web Audio API
    // For now, we'll just use the video file directly as OpenAI Whisper supports video formats
    return videoFile;
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioFile: File, sourceLanguage?: string): Promise<{
    text: string;
    language: string;
    segments: Array<{ text: string; start: number; end: number }>;
  }> {
    console.log('[Fast Dubbing] Step 1: Transcribing audio...');

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    if (sourceLanguage) {
      formData.append('language', sourceLanguage);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openai.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Transcription failed: ${error}`);
    }

    const data = await response.json();

    return {
      text: data.text,
      language: data.language,
      segments: data.segments || [],
    };
  }

  /**
   * Translate text using GPT-4
   */
  async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    console.log('[Fast Dubbing] Step 2: Translating text...');

    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
    };

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text from ${languageNames[sourceLanguage] || sourceLanguage} to ${languageNames[targetLanguage] || targetLanguage}. Maintain the same tone, style, and natural flow. Only return the translated text, nothing else.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    });

    return response.choices[0].message.content || text;
  }

  /**
   * Generate speech using ElevenLabs TTS
   */
  async generateSpeech(text: string, voiceId: string = 'ErXwobaYiN019PkySvjV'): Promise<Blob> {
    console.log('[Fast Dubbing] Step 3: Generating dubbed audio...');

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS generation failed: ${error}`);
    }

    return await response.blob();
  }

  /**
   * Main dubbing workflow
   */
  async dubVideo(
    videoFile: File,
    targetLanguage: string,
    sourceLanguage?: string,
    onProgress?: (progress: FastDubbingProgress) => void
  ): Promise<{
    translatedText: string;
    audioBlob: Blob;
    originalText: string;
    detectedLanguage: string;
  }> {
    try {
      // Step 1: Extract audio
      onProgress?.({
        step: 'extracting',
        progress: 10,
        message: 'Extracting audio from video...'
      });

      const audioFile = await this.extractAudio(videoFile);

      // Step 2: Transcribe
      onProgress?.({
        step: 'transcribing',
        progress: 30,
        message: 'Transcribing audio with AI...'
      });

      const transcription = await this.transcribeAudio(audioFile, sourceLanguage);

      // Step 3: Translate
      onProgress?.({
        step: 'translating',
        progress: 60,
        message: 'Translating to target language...'
      });

      const translatedText = await this.translateText(
        transcription.text,
        transcription.language,
        targetLanguage
      );

      // Step 4: Generate speech
      onProgress?.({
        step: 'generating',
        progress: 80,
        message: 'Generating dubbed audio...'
      });

      const audioBlob = await this.generateSpeech(translatedText);

      onProgress?.({
        step: 'complete',
        progress: 100,
        message: 'Dubbing complete!'
      });

      return {
        translatedText,
        audioBlob,
        originalText: transcription.text,
        detectedLanguage: transcription.language,
      };

    } catch (error) {
      console.error('[Fast Dubbing] Error:', error);
      throw error;
    }
  }
}
