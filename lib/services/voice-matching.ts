import { VoiceCharacteristics } from './gemini';
import { ElevenLabsService } from './elevenlabs';

export interface VoiceMatch {
  voiceId: string;
  name: string;
  matchScore: number;  // 0-100
  matchReasons: string[];
  previewUrl?: string;
  labels: {
    accent?: string;
    description?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
}

export class VoiceMatchingService {
  private elevenLabsService: ElevenLabsService;

  constructor(elevenLabsApiKey: string) {
    this.elevenLabsService = new ElevenLabsService(elevenLabsApiKey);
  }

  /**
   * Find ElevenLabs voices that match the original voice characteristics
   */
  async findMatchingVoices(
    originalVoice: VoiceCharacteristics,
    targetLanguage: string,
    maxResults: number = 5
  ): Promise<VoiceMatch[]> {
    try {
      // Get all available voices from ElevenLabs
      const allVoices = await this.elevenLabsService.getVoices();

      // Score each voice based on how well it matches
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

      // Sort by match score and return top results
      const topMatches = scoredVoices
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, maxResults);

      return topMatches;
    } catch (error) {
      console.error('Voice matching error:', error);
      throw new Error(`Failed to match voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate match score between original voice and ElevenLabs voice
   */
  private calculateMatchScore(
    original: VoiceCharacteristics,
    elevenLabsVoice: any
  ): number {
    let score = 0;
    const labels = elevenLabsVoice.labels || {};
    const name = elevenLabsVoice.name?.toLowerCase() || '';
    const description = (labels.description || '').toLowerCase();

    // Gender matching (30 points)
    if (labels.gender) {
      if (labels.gender.toLowerCase() === original.gender) {
        score += 30;
      }
    } else if (name.includes(original.gender)) {
      score += 20;
    }

    // Age matching (20 points)
    const ageKeywords = {
      'young': ['young', 'youthful', 'teen'],
      'middle-aged': ['middle', 'mature', 'adult'],
      'mature': ['mature', 'experienced', 'senior'],
      'elderly': ['elderly', 'old', 'senior', 'wise']
    };

    const ageWords = ageKeywords[original.ageRange] || [];
    if (ageWords.some(word => name.includes(word) || description.includes(word))) {
      score += 20;
    }

    // Accent matching (15 points)
    if (labels.accent) {
      if (labels.accent.toLowerCase().includes(original.accent.toLowerCase())) {
        score += 15;
      }
    } else if (description.includes(original.accent.toLowerCase())) {
      score += 10;
    }

    // Tone matching (20 points)
    const toneMatches = original.tone.filter(tone =>
      name.includes(tone.toLowerCase()) || description.includes(tone.toLowerCase())
    );
    score += Math.min(20, toneMatches.length * 5);

    // Emotion matching (15 points)
    const emotionMatches = original.emotion.filter(emotion =>
      name.includes(emotion.toLowerCase()) || description.includes(emotion.toLowerCase())
    );
    score += Math.min(15, emotionMatches.length * 5);

    return Math.round(score);
  }

  /**
   * Get human-readable reasons for the match
   */
  private getMatchReasons(
    original: VoiceCharacteristics,
    elevenLabsVoice: any
  ): string[] {
    const reasons: string[] = [];
    const labels = elevenLabsVoice.labels || {};
    const name = elevenLabsVoice.name?.toLowerCase() || '';
    const description = (labels.description || '').toLowerCase();

    // Gender match
    if (labels.gender?.toLowerCase() === original.gender) {
      reasons.push(`Same gender (${original.gender})`);
    }

    // Age match
    const ageKeywords = {
      'young': ['young', 'youthful'],
      'middle-aged': ['middle', 'mature'],
      'mature': ['mature', 'experienced'],
      'elderly': ['elderly', 'senior']
    };
    const ageWords = ageKeywords[original.ageRange] || [];
    if (ageWords.some(word => name.includes(word) || description.includes(word))) {
      reasons.push(`Similar age range (${original.ageRange})`);
    }

    // Accent match
    if (labels.accent?.toLowerCase().includes(original.accent.toLowerCase())) {
      reasons.push(`Matching accent (${original.accent})`);
    }

    // Tone matches
    const toneMatches = original.tone.filter(tone =>
      name.includes(tone.toLowerCase()) || description.includes(tone.toLowerCase())
    );
    if (toneMatches.length > 0) {
      reasons.push(`Similar tone: ${toneMatches.join(', ')}`);
    }

    // Emotion matches
    const emotionMatches = original.emotion.filter(emotion =>
      name.includes(emotion.toLowerCase()) || description.includes(emotion.toLowerCase())
    );
    if (emotionMatches.length > 0) {
      reasons.push(`Similar emotion: ${emotionMatches.join(', ')}`);
    }

    // Pitch/pace from description
    if (original.pitch === 'low' && description.includes('deep')) {
      reasons.push('Deep/low pitch');
    } else if (original.pitch === 'high' && (description.includes('bright') || description.includes('light'))) {
      reasons.push('Bright/high pitch');
    }

    if (reasons.length === 0) {
      reasons.push('General voice characteristics match');
    }

    return reasons;
  }

  /**
   * Get voice recommendations with detailed comparison
   */
  async getVoiceRecommendations(
    originalVoice: VoiceCharacteristics,
    targetLanguage: string
  ): Promise<{
    originalCharacteristics: VoiceCharacteristics;
    recommendedVoices: VoiceMatch[];
    summary: string;
  }> {
    const matches = await this.findMatchingVoices(originalVoice, targetLanguage, 5);

    const summary = `Based on the original voice (${original Voice.gender}, ${originalVoice.ageRange}, ${originalVoice.tone.join(', ')}), we found ${matches.length} similar voices. The top match has a ${matches[0]?.matchScore}% similarity score.`;

    return {
      originalCharacteristics: originalVoice,
      recommendedVoices: matches,
      summary
    };
  }
}

export default VoiceMatchingService;
