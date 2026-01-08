import { VoiceCharacteristics, VoiceMatch } from '../types';
import { ElevenLabsService, ElevenLabsVoice } from './elevenlabs';

export class VoiceMatchingService {
  private elevenLabsService: ElevenLabsService;

  constructor(elevenLabsApiKey: string) {
    this.elevenLabsService = new ElevenLabsService(elevenLabsApiKey);
  }

  async findMatchingVoices(
    originalVoice: VoiceCharacteristics,
    targetLanguage: string,
    maxResults: number = 5
  ): Promise<VoiceMatch[]> {
    try {
      const allVoices = await this.elevenLabsService.getVoices();

      const scoredVoices = allVoices.map(voice => {
        const matchScore = this.calculateMatchScore(originalVoice, voice);
        const matchReasons = this.getMatchReasons(originalVoice, voice);

        return {
          voiceId: voice.voice_id,
          name: voice.name,
          matchScore,
          matchReasons,
          previewUrl: voice.preview_url,
          labels: voice.labels || {}
        };
      });

      const topMatches = scoredVoices
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, maxResults);

      return topMatches;
    } catch (error) {
      console.error('Voice matching error:', error);
      throw new Error(`Failed to find matching voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateMatchScore(original: VoiceCharacteristics, voice: ElevenLabsVoice): number {
    let score = 0;

    // Gender match (30 points)
    if (voice.labels.gender && voice.labels.gender.toLowerCase() === original.gender.toLowerCase()) {
      score += 30;
    }

    // Age match (20 points)
    if (voice.labels.age) {
      const ageMatch = this.compareAge(original.ageRange, voice.labels.age);
      score += ageMatch * 20;
    }

    // Accent match (15 points)
    if (voice.labels.accent) {
      const accentSimilarity = this.compareAccent(original.accent, voice.labels.accent);
      score += accentSimilarity * 15;
    }

    // Tone match (20 points)
    if (voice.labels.description) {
      const toneSimilarity = this.compareTone(original.tone, voice.labels.description);
      score += toneSimilarity * 20;
    }

    // Emotion match (15 points)
    if (voice.labels.use_case) {
      const emotionSimilarity = this.compareEmotion(original.emotion, voice.labels.use_case);
      score += emotionSimilarity * 15;
    }

    return Math.round(score);
  }

  private compareAge(originalAge: string, voiceAge: string): number {
    const ageMap: Record<string, number> = {
      'young': 1,
      'middle-aged': 2,
      'mature': 3,
      'elderly': 4
    };

    const original = ageMap[originalAge] || 2;
    const voice = ageMap[voiceAge.toLowerCase()] || 2;
    const diff = Math.abs(original - voice);

    return diff === 0 ? 1 : diff === 1 ? 0.7 : diff === 2 ? 0.4 : 0;
  }

  private compareAccent(originalAccent: string, voiceAccent: string): number {
    const original = originalAccent.toLowerCase();
    const voice = voiceAccent.toLowerCase();

    if (original === voice) return 1;
    if (original.includes(voice) || voice.includes(original)) return 0.7;
    if (original.includes('american') && voice.includes('american')) return 0.9;
    if (original.includes('british') && voice.includes('british')) return 0.9;
    return 0.3;
  }

  private compareTone(originalTones: string[], voiceDescription: string): number {
    const description = voiceDescription.toLowerCase();
    let matches = 0;

    for (const tone of originalTones) {
      if (description.includes(tone.toLowerCase())) {
        matches++;
      }
    }

    return originalTones.length > 0 ? matches / originalTones.length : 0;
  }

  private compareEmotion(originalEmotions: string[], voiceUseCase: string): number {
    const useCase = voiceUseCase.toLowerCase();
    let matches = 0;

    for (const emotion of originalEmotions) {
      if (useCase.includes(emotion.toLowerCase())) {
        matches++;
      }
    }

    return originalEmotions.length > 0 ? matches / originalEmotions.length : 0;
  }

  private getMatchReasons(original: VoiceCharacteristics, voice: ElevenLabsVoice): string[] {
    const reasons: string[] = [];

    if (voice.labels.gender && voice.labels.gender.toLowerCase() === original.gender.toLowerCase()) {
      reasons.push(`Matches ${original.gender} gender`);
    }

    if (voice.labels.age) {
      const ageMatch = this.compareAge(original.ageRange, voice.labels.age);
      if (ageMatch > 0.5) {
        reasons.push(`Similar age range (${voice.labels.age})`);
      }
    }

    if (voice.labels.accent) {
      const accentSimilarity = this.compareAccent(original.accent, voice.labels.accent);
      if (accentSimilarity > 0.5) {
        reasons.push(`Compatible accent (${voice.labels.accent})`);
      }
    }

    if (voice.labels.description) {
      for (const tone of original.tone) {
        if (voice.labels.description.toLowerCase().includes(tone.toLowerCase())) {
          reasons.push(`Shares "${tone}" tone`);
        }
      }
    }

    return reasons.length > 0 ? reasons : ['General voice similarity'];
  }

  async getVoiceRecommendations(
    originalVoice: VoiceCharacteristics,
    targetLanguage: string
  ): Promise<{
    originalCharacteristics: VoiceCharacteristics;
    recommendedVoices: VoiceMatch[];
    summary: string;
  }> {
    const matches = await this.findMatchingVoices(originalVoice, targetLanguage, 5);

    const summary = `Based on the original voice (${originalVoice.gender}, ${originalVoice.ageRange}, ${originalVoice.tone.join(', ')}), we found ${matches.length} similar voices. The top match has a ${matches[0]?.matchScore}% similarity score.`;

    return {
      originalCharacteristics: originalVoice,
      recommendedVoices: matches,
      summary
    };
  }
}

export default VoiceMatchingService;
