export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI Video Localization Tool
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Professional video translation with AI-powered lip-sync, voice matching, and context-aware translation.
        </p>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span><strong>Gemini AI Video Analysis</strong> - Intelligent scene understanding and context-aware translation</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span><strong>Voice Matching</strong> - AI-powered voice characteristic analysis and similarity matching</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span><strong>ElevenLabs Voice Generation</strong> - Natural, multilingual voice synthesis</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span><strong>HeyGen Lip-Sync</strong> - Automatic AI lip-sync for translated videos</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-4">API Endpoints</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <code className="text-sm font-mono text-gray-800">/api/analyze-video</code>
              <p className="text-sm text-gray-600 mt-1">Analyze video with Gemini AI</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <code className="text-sm font-mono text-gray-800">/api/recommend-voices</code>
              <p className="text-sm text-gray-600 mt-1">Get voice recommendations based on original voice</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <code className="text-sm font-mono text-gray-800">/api/text-to-speech</code>
              <p className="text-sm text-gray-600 mt-1">Generate speech with ElevenLabs</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <code className="text-sm font-mono text-gray-800">/api/generate-video</code>
              <p className="text-sm text-gray-600 mt-1">Create lip-synced video with HeyGen</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Configure your API keys in environment variables:</p>
          <p className="font-mono mt-2">GEMINI_API_KEY, ELEVENLABS_API_KEY, HEYGEN_API_KEY</p>
        </div>
      </div>
    </main>
  );
}
