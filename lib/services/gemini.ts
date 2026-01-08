import { GoogleGenerativeAI } from '@google/generative-ai';
import { VideoAnalysisResult, VoiceCharacteristics } from '../types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
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
      const videoBuffer = await videoFile.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');

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
        throw new Error('Failed to parse voice characteristics');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Voice analysis error:', error);
      throw new Error(`Voice analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default GeminiService;
