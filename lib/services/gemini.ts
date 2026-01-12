import { GoogleGenerativeAI } from '@google/generative-ai';
import { VideoAnalysisResult, VoiceCharacteristics } from '../types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Using Gemini Flash model - available on free tier and supports video analysis
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async analyzeVideo(videoFile: File): Promise<VideoAnalysisResult> {
    try {
      const videoBuffer = await videoFile.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');

      const prompt = `Analyze this video and provide:
1. Full transcript with timestamps
2. Description of key visual scenes
3. Overall context and mood
4. Detected language
5. Estimated duration

Return as JSON: {
  "transcript": [{"text": "...", "start": 0, "end": 5}],
  "scenes": ["scene description 1", "scene description 2"],
  "visualContext": "overall description",
  "duration": 60,
  "language": "en"
}`;

      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: videoFile.type,
            data: videoBase64
          }
        },
        { text: prompt }
      ]);

      const response = result.response.text();
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse Gemini response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Gemini video analysis error:', error);
      throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeVoiceCharacteristics(videoFile: File): Promise<VoiceCharacteristics> {
    try {
      console.log('analyzeVoiceCharacteristics - Starting analysis');
      console.log('Video file details:', {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type
      });

      // Validate file
      if (!videoFile || videoFile.size === 0) {
        throw new Error('Invalid video file: file is empty or undefined');
      }

      if (videoFile.size > 20 * 1024 * 1024) {
        throw new Error('Video file too large for Gemini API (max 20MB)');
      }

      console.log('Converting video to base64...');
      const videoBuffer = await videoFile.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');
      console.log('Base64 conversion complete, length:', videoBase64.length);

      // Determine mime type - default to video/mp4 if not available
      const mimeType = videoFile.type || 'video/mp4';
      console.log('Using mime type:', mimeType);

      const prompt = `Analyze the voice characteristics in this video's audio. Focus on:
1. Gender (male/female/neutral)
2. Age range (young/middle-aged/mature/elderly)
3. Tone qualities (warm, authoritative, friendly, professional, etc.)
4. Speaking pace (slow/moderate/fast)
5. Pitch level (low/medium/high)
6. Accent or regional characteristics
7. Emotional qualities (calm, energetic, enthusiastic, serious, etc.)
8. Overall voice description

Return ONLY valid JSON: {
  "gender": "male",
  "ageRange": "middle-aged",
  "tone": ["authoritative", "professional", "warm"],
  "pace": "moderate",
  "pitch": "medium",
  "accent": "neutral American",
  "emotion": ["confident", "calm"],
  "description": "A warm, authoritative male voice..."
}`;

      console.log('Calling Gemini API with prompt...');
      console.log('Prompt length:', prompt.length);

      let result;
      try {
        result = await this.model.generateContent([
          {
            inlineData: {
              mimeType: mimeType,
              data: videoBase64
            }
          },
          { text: prompt }
        ]);
        console.log('Gemini API call completed');
      } catch (apiError) {
        console.error('Gemini API call failed:', apiError);
        // Extract more specific error information
        if (apiError instanceof Error) {
          console.error('API Error details:', {
            name: apiError.name,
            message: apiError.message,
            stack: apiError.stack
          });
        }
        throw apiError;
      }

      console.log('Getting response text...');
      const response = result.response.text();
      console.log('Raw Gemini response (first 200 chars):', response.substring(0, 200));

      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('Failed to extract JSON from response:', response);
        throw new Error('Failed to parse voice characteristics - no JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Successfully parsed voice characteristics:', parsed);
      return parsed;
    } catch (error) {
      console.error('Voice analysis error - Full details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Gemini API key is invalid or not configured properly');
        }
        if (error.message.includes('quota')) {
          throw new Error('Gemini API quota exceeded - please check your API limits');
        }
        if (error.message.includes('permission')) {
          throw new Error('Gemini API permission denied - check API key permissions');
        }
      }

      throw new Error(`Voice analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default GeminiService;
