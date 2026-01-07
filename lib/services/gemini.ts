import { GoogleGenerativeAI } from '@google/generative-ai';
import { VideoAnalysis, TranscriptSegment, Scene, VisualContext, AudioFeatures } from '../types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Analyze video file and extract comprehensive information
   */
  async analyzeVideo(videoFile: File): Promise<VideoAnalysis> {
    try {
      // Convert video to base64 for Gemini API
      const base64Video = await this.fileToBase64(videoFile);

      const prompt = `Analyze this video in detail and provide:
1. Scene breakdown with timestamps
2. Full transcript with speaker detection
3. Visual context (setting, mood, objects, colors)
4. Audio features (language, number of speakers, background music)

Format your response as JSON with this structure:
{
  "scenes": [{"startTime": 0, "endTime": 5, "description": "", "objects": [], "actions": [], "setting": ""}],
  "transcript": [{"startTime": 0, "endTime": 3, "text": "", "speaker": "Speaker 1"}],
  "visualContext": {"dominantColors": [], "setting": "", "mood": "", "keyObjects": []},
  "audioFeatures": {"language": "en", "numSpeakers": 1, "backgroundMusic": false, "noiseLevel": "low"}
}`;

      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: videoFile.type,
            data: base64Video
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();

      // Extract JSON from response (Gemini might wrap it in markdown)
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const analysisData = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(text);

      return analysisData as VideoAnalysis;
    } catch (error) {
      console.error('Gemini video analysis error:', error);
      throw new Error(`Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract and transcribe audio from video
   */
  async transcribeVideo(videoFile: File): Promise<TranscriptSegment[]> {
    try {
      const base64Video = await this.fileToBase64(videoFile);

      const prompt = `Extract and transcribe all speech from this video. Include timestamps.
Return as JSON array: [{"startTime": 0, "endTime": 3, "text": "...", "speaker": "Speaker 1", "confidence": 0.95}]`;

      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: videoFile.type,
            data: base64Video
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[[\s\S]*\]/);
      const transcriptData = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(text);

      return transcriptData as TranscriptSegment[];
    } catch (error) {
      console.error('Gemini transcription error:', error);
      throw new Error(`Failed to transcribe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get visual context for better translation
   */
  async getVisualContext(videoFile: File, timestamp?: number): Promise<VisualContext> {
    try {
      const base64Video = await this.fileToBase64(videoFile);

      const prompt = `Analyze the visual context of this video${timestamp !== undefined ? ` at ${timestamp} seconds` : ''}.
Describe the setting, mood, dominant colors, and key objects.
Return as JSON: {"dominantColors": [], "setting": "", "mood": "", "keyObjects": []}`;

      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: videoFile.type,
            data: base64Video
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const contextData = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(text);

      return contextData as VisualContext;
    } catch (error) {
      console.error('Gemini visual context error:', error);
      throw new Error(`Failed to get visual context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert file to base64 string
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export default GeminiService;
