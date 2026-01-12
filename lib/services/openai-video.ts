import OpenAI from 'openai';
import { VideoAnalysisResult, VoiceCharacteristics } from '../types';

export class OpenAIVideoService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeVideo(videoFile: File): Promise<VideoAnalysisResult> {
    try {
      const videoBuffer = await videoFile.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this video and provide:
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
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${videoFile.type};base64,${videoBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const content = response.choices[0].message.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse OpenAI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('OpenAI video analysis error:', error);
      throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeVoiceCharacteristics(videoFile: File): Promise<VoiceCharacteristics> {
    try {
      console.log('analyzeVoiceCharacteristics - Starting analysis with OpenAI');
      console.log('Video file details:', {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type
      });

      // Validate file
      if (!videoFile || videoFile.size === 0) {
        throw new Error('Invalid video file: file is empty or undefined');
      }

      console.log('Converting video to base64...');
      const videoBuffer = await videoFile.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');
      console.log('Base64 conversion complete, length:', videoBase64.length);

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

      console.log('Calling OpenAI GPT-4o API...');
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${videoBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      console.log('OpenAI API call completed');
      const content = response.choices[0].message.content || '';
      console.log('Raw OpenAI response (first 200 chars):', content.substring(0, 200));

      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('Failed to extract JSON from response:', content);
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

      throw new Error(`Voice analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default OpenAIVideoService;
