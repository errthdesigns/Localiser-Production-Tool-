import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranslationRequest, TranslationResult, VideoAnalysis } from '../types';

export class TranslationService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Translate text with context awareness for video dubbing
   */
  async translate(request: TranslationRequest, videoContext?: VideoAnalysis): Promise<TranslationResult> {
    try {
      const {
        text,
        sourceLanguage,
        targetLanguage,
        context,
        preserveTiming = true,
        maxLength
      } = request;

      const contextInfo = this.buildContextInfo(videoContext, context);

      const prompt = `You are a professional video localization translator specializing in dubbing.

SOURCE LANGUAGE: ${sourceLanguage}
TARGET LANGUAGE: ${targetLanguage}

TEXT TO TRANSLATE:
"${text}"

${contextInfo}

REQUIREMENTS:
${preserveTiming ? '- PRESERVE TIMING: Translation must match original duration for lip-sync' : ''}
${maxLength ? `- MAX LENGTH: ${maxLength} characters` : ''}
- Maintain natural, conversational tone suitable for spoken dialogue
- Consider cultural context and idioms
- Ensure proper emotional tone matches the scene
- Keep technical terms consistent

Provide your response as JSON:
{
  "translatedText": "...",
  "sourceLanguage": "${sourceLanguage}",
  "targetLanguage": "${targetLanguage}",
  "confidence": 0.95,
  "alternativeTranslations": ["alt1", "alt2"],
  "timingMatch": true
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
      const translationData = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(responseText);

      return translationData as TranslationResult;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch translate multiple segments
   */
  async translateSegments(
    segments: Array<{ text: string; startTime: number; endTime: number }>,
    sourceLanguage: string,
    targetLanguage: string,
    videoContext?: VideoAnalysis
  ): Promise<TranslationResult[]> {
    try {
      const translations = await Promise.all(
        segments.map(async (segment) => {
          const duration = segment.endTime - segment.startTime;
          const maxLength = Math.floor(segment.text.length * 1.2); // Allow 20% length variance

          return this.translate(
            {
              text: segment.text,
              sourceLanguage,
              targetLanguage,
              context: `Segment timestamp: ${segment.startTime}s - ${segment.endTime}s`,
              preserveTiming: true,
              maxLength
            },
            videoContext
          );
        })
      );

      return translations;
    } catch (error) {
      console.error('Batch translation error:', error);
      throw new Error(`Batch translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify translation quality
   */
  async verifyTranslation(
    original: string,
    translated: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<{
    accuracy: number;
    fluency: number;
    culturalAppropriateness: number;
    timingSuitability: number;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const prompt = `As a professional translation quality assessor for video dubbing, evaluate this translation:

ORIGINAL (${sourceLanguage}):
"${original}"

TRANSLATION (${targetLanguage}):
"${translated}"

Evaluate on:
1. **Accuracy** (0-100): Meaning preserved correctly?
2. **Fluency** (0-100): Natural in target language?
3. **Cultural Appropriateness** (0-100): Culturally suitable?
4. **Timing Suitability** (0-100): Length appropriate for dubbing?

Return as JSON:
{
  "accuracy": 95,
  "fluency": 90,
  "culturalAppropriateness": 95,
  "timingSuitability": 85,
  "issues": ["Slightly longer than original"],
  "suggestions": ["Consider shorter phrase for better timing"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const verification = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(text);

      return verification;
    } catch (error) {
      console.error('Translation verification error:', error);
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build context information for better translation
   */
  private buildContextInfo(videoContext?: VideoAnalysis, additionalContext?: string): string {
    if (!videoContext && !additionalContext) return '';

    let contextParts: string[] = [];

    if (additionalContext) {
      contextParts.push(`CONTEXT: ${additionalContext}`);
    }

    if (videoContext) {
      if (videoContext.visualContext) {
        contextParts.push(`VISUAL SETTING: ${videoContext.visualContext.setting}`);
        contextParts.push(`MOOD: ${videoContext.visualContext.mood}`);
      }

      if (videoContext.scenes && videoContext.scenes.length > 0) {
        const sceneInfo = videoContext.scenes[0];
        contextParts.push(`SCENE: ${sceneInfo.description}`);
      }
    }

    return contextParts.length > 0 ? '\n' + contextParts.join('\n') : '';
  }
}

export default TranslationService;
