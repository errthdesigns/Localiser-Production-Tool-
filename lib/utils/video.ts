import { VideoMetadata } from '../types';

/**
 * Extract video metadata from file
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout loading video metadata'));
    }, 10000);

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 25, // Default, can't reliably detect from browser
        fileSize: file.size,
        mimeType: file.type
      });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
    };

    video.src = URL.createObjectURL(file);
    video.load();
  });
}

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' bytes';
}

/**
 * Validate video file
 */
export function isValidVideoFile(file: File): boolean {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
  const maxSize = 500 * 1024 * 1024; // 500MB

  if (!validTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Supported: MP4, MOV, WebM, AVI`);
  }

  if (file.size > maxSize) {
    throw new Error(`File too large: ${formatFileSize(file.size)}. Maximum: 500MB`);
  }

  return true;
}

/**
 * Convert file to base64 (for API transmission)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Create a Blob URL for video preview
 */
export function createVideoPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
