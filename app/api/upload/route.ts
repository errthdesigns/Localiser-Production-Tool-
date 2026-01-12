import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // You can add validation here if needed
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB limit
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
