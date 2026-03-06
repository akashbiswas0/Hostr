/* eslint-disable @typescript-eslint/no-explicit-any */
import imagedbSdk from './imagedb-sdk.js';

interface ImageDBClient {
  upload(file: File | Blob, options?: { idempotencyKey?: string; ttlDays?: number; userId?: string }): Promise<{ media_id: string }>;
  get(mediaId: string, options?: { asBlob?: boolean }): Promise<Blob>;
}

const client = new (imagedbSdk as any)('/api/imagedb') as ImageDBClient;
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function uploadEventImage(file: File): Promise<string> {
  const key = `event-${Date.now()}-${file.name}`;
  console.log("[imagedb] uploading via proxy /api/imagedb", { key, size: file.size });
  const result = await client.upload(file, {
    idempotencyKey: key,
    ttlDays: 30,
  });
  console.log("[imagedb] upload response:", result);
  if (!result.media_id) {
    throw new Error(`Unexpected response from ImageDB: ${JSON.stringify(result)}`);
  }
  return result.media_id;
}

export async function getEventImageUrl(mediaId: string): Promise<string> {
  const blob = await client.get(mediaId);
  return URL.createObjectURL(blob);
}
