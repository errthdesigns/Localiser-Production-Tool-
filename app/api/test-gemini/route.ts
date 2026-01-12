import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    console.log('Testing Gemini API...');
    console.log('Has API key:', !!geminiApiKey);
    console.log('API key length:', geminiApiKey?.length || 0);
    console.log('API key prefix:', geminiApiKey?.substring(0, 20) || 'NOT_SET');

    if (!geminiApiKey) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY not found in environment variables',
          success: false
        },
        { status: 500 }
      );
    }

    // Test basic text generation
    console.log('Initializing Gemini...');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    console.log('Sending test prompt...');
    const result = await model.generateContent('Say "API is working" if you can read this.');
    const response = await result.response;
    const text = response.text();

    console.log('Gemini response:', text);

    return NextResponse.json({
      success: true,
      message: 'Gemini API is working',
      response: text,
      apiKeyPrefix: geminiApiKey.substring(0, 20),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gemini test error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor.name,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
