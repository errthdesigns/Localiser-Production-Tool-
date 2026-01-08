# Voice Matching System

## Overview

The Voice Matching System analyzes the original video's voice characteristics and recommends ElevenLabs voices that sound similar. This ensures voice consistency between the original and localized versions.

## How It Works

### 1. Voice Analysis (Gemini AI)

Gemini analyzes the original video audio and extracts:

- **Gender**: Male, Female, or Neutral
- **Age Range**: Young, Middle-aged, Mature, or Elderly
- **Tone**: Authoritative, Warm, Friendly, Professional, Casual, Serious, etc.
- **Pace**: Slow, Moderate, or Fast
- **Pitch**: Low, Medium, or High
- **Accent**: American, British, Australian, etc.
- **Emotion**: Calm, Energetic, Confident, Serious, Soothing, etc.
- **Description**: Natural language summary

### 2. Voice Matching Algorithm

The system scores each ElevenLabs voice based on similarity:

| Characteristic | Weight | Impact |
|---------------|--------|--------|
| Gender | 30% | Strong match if exact |
| Tone | 20% | Keywords in name/description |
| Age | 20% | Age-related keywords |
| Emotion | 15% | Emotion keywords match |
| Accent | 15% | Accent match |

**Match Score**: 0-100 (100 = perfect match)

### 3. Recommendations

Returns top 5 matching voices with:
- Match score percentage
- Specific reasons for match
- Voice preview URL
- ElevenLabs voice ID

## API Usage

### Endpoint: `/api/recommend-voices`

#### POST: Analyze Video & Recommend Voices

```typescript
// FormData
const formData = new FormData();
formData.append('video', videoFile);
formData.append('targetLanguage', 'German');
formData.append('maxResults', '5');

const response = await fetch('/api/recommend-voices', {
  method: 'POST',
  body: formData
});

const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalVoice": {
      "gender": "male",
      "ageRange": "middle-aged",
      "tone": ["authoritative", "professional", "warm"],
      "pace": "moderate",
      "pitch": "medium",
      "accent": "American",
      "emotion": ["confident", "engaging"],
      "description": "A confident, professional male voice with warm undertones..."
    },
    "recommendations": [
      {
        "voiceId": "pNInz6obpgDQGcFmaJgB",
        "name": "Adam - Professional American",
        "matchScore": 85,
        "matchReasons": [
          "Same gender (male)",
          "Similar age range (middle-aged)",
          "Matching accent (American)",
          "Similar tone: authoritative, professional"
        ],
        "previewUrl": "https://storage.googleapis.com/...",
        "labels": {
          "accent": "american",
          "gender": "male",
          "age": "middle_aged",
          "use_case": "narration"
        }
      },
      // ... 4 more recommendations
    ],
    "summary": "Based on the original voice (male, middle-aged, authoritative, professional, warm), we found 5 similar voices. The top match has a 85% similarity score."
  }
}
```

#### GET: Cached Voice Recommendations

If you already have voice characteristics:

```typescript
const params = new URLSearchParams({
  voiceCharacteristics: JSON.stringify(voiceChars),
  targetLanguage: 'French',
  maxResults: '3'
});

const response = await fetch(`/api/recommend-voices?${params}`);
```

## Programmatic Usage

### Using the Service Directly

```typescript
import { GeminiService } from '@/lib/services/gemini';
import { VoiceMatchingService } from '@/lib/services/voice-matching';

// Analyze voice
const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
const voiceChars = await gemini.analyzeVoiceCharacteristics(videoFile);

console.log('Original voice:', voiceChars);
// {
//   gender: 'female',
//   ageRange: 'young',
//   tone: ['energetic', 'friendly', 'upbeat'],
//   ...
// }

// Find matching voices
const matcher = new VoiceMatchingService(process.env.ELEVENLABS_API_KEY!);
const matches = await matcher.findMatchingVoices(voiceChars, 'Spanish', 5);

matches.forEach(match => {
  console.log(`${match.name}: ${match.matchScore}% match`);
  console.log(`Reasons: ${match.matchReasons.join(', ')}`);
  console.log(`Preview: ${match.previewUrl}`);
});
```

## Example Workflow

### Scenario: Corporate Training Video

**Original Voice Analysis:**
```json
{
  "gender": "female",
  "ageRange": "middle-aged",
  "tone": ["professional", "clear", "confident"],
  "pace": "moderate",
  "pitch": "medium",
  "accent": "British",
  "emotion": ["calm", "authoritative"]
}
```

**Top Recommendations:**
1. **"Rachel - British Professional"** (92% match)
   - Same gender ✓
   - Similar age ✓
   - Matching accent (British) ✓
   - Similar tone: professional, confident ✓

2. **"Charlotte - UK Corporate"** (88% match)
   - Same gender ✓
   - Similar age ✓
   - Matching accent (British) ✓
   - Professional tone ✓

3. **"Emily - Narrator"** (82% match)
   - Same gender ✓
   - Clear, calm delivery ✓
   - Professional use case ✓

### Scenario: YouTube Creator

**Original Voice Analysis:**
```json
{
  "gender": "male",
  "ageRange": "young",
  "tone": ["energetic", "casual", "enthusiastic"],
  "pace": "fast",
  "pitch": "medium",
  "accent": "American",
  "emotion": ["excited", "engaging"]
}
```

**Top Recommendations:**
1. **"Josh - Energetic American"** (90% match)
   - Same gender ✓
   - Young age ✓
   - American accent ✓
   - Energetic, enthusiastic ✓

2. **"Clyde - Dynamic"** (85% match)
   - Male voice ✓
   - Fast-paced ✓
   - Engaging tone ✓

## Integration into Full Workflow

```typescript
// Step 1: Upload video
const videoFile = /* uploaded file */;

// Step 2: Get voice recommendations
const voiceRecs = await fetch('/api/recommend-voices', {
  method: 'POST',
  body: createFormData(videoFile, 'German')
});

const { recommendations } = await voiceRecs.json();

// Step 3: Show user the top 3 matches with preview
recommendations.slice(0, 3).forEach(voice => {
  displayVoiceCard({
    name: voice.name,
    matchScore: voice.matchScore,
    reasons: voice.matchReasons,
    previewUrl: voice.previewUrl
  });
});

// Step 4: User selects preferred voice
const selectedVoiceId = userSelection; // e.g., recommendations[0].voiceId

// Step 5: Process localization with selected voice
const result = await fetch('/api/process-localization', {
  method: 'POST',
  body: createLocalizationFormData(videoFile, 'German', selectedVoiceId)
});
```

## UI Component Example

```tsx
function VoiceSelector({ recommendations }) {
  const [selectedVoice, setSelectedVoice] = useState(null);

  return (
    <div className="voice-selector">
      <h3>Select Voice That Matches Original</h3>
      <p className="original-description">
        Original: {recommendations.originalVoice.description}
      </p>

      <div className="voice-grid">
        {recommendations.recommendedVoices.map(voice => (
          <div
            key={voice.voiceId}
            className={`voice-card ${selectedVoice === voice.voiceId ? 'selected' : ''}`}
            onClick={() => setSelectedVoice(voice.voiceId)}
          >
            <div className="voice-header">
              <h4>{voice.name}</h4>
              <span className="match-score">{voice.matchScore}% match</span>
            </div>

            <ul className="match-reasons">
              {voice.matchReasons.map((reason, i) => (
                <li key={i}>✓ {reason}</li>
              ))}
            </ul>

            <audio controls src={voice.previewUrl} />

            <button className="select-voice">
              {selectedVoice === voice.voiceId ? 'Selected' : 'Select This Voice'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Accuracy Tips

### For Best Results:

1. **Clear Audio**: Original video should have clear, unobstructed voice
2. **Single Speaker**: Works best with one primary speaker
3. **Good Quality**: Higher quality video = better voice analysis
4. **Minimal Background Noise**: Less noise = more accurate characteristics

### If Match Scores Are Low:

- The original voice might be very unique
- Consider the top 3 recommendations regardless of score
- Preview each voice to make final decision
- Match scores 70%+ are generally good matches

## Cost

**Voice Analysis**: ~$0.02 per video (Gemini API)
**Voice Matching**: Free (computed locally)

**Total**: ~$0.02 per analysis

## Benefits

✅ **Voice Consistency**: Localized videos sound similar to originals
✅ **Brand Voice**: Maintain brand voice across languages
✅ **Automated Selection**: No manual voice browsing needed
✅ **Quality Assurance**: Data-driven voice recommendations
✅ **User Choice**: Show top options, let user decide

## Limitations

⚠️ **Subjective Matching**: Voice similarity is partially subjective
⚠️ **Accent Availability**: Not all accents available in all languages
⚠️ **Unique Voices**: Very distinctive voices may have lower match scores
⚠️ **Preview Required**: Users should always preview before finalizing

## Future Enhancements

- **Voice cloning** integration for exact matches
- **A/B testing** with multiple voices
- **User feedback** to improve matching algorithm
- **Voice characteristic** caching for faster repeat processing
