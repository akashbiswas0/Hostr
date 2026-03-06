import { CONFIG, MediaMetadata, UploadSession } from "./types";
import { ChunkingService } from "./chunking";
import { storage } from "./storage";

// In-process session cache (TTL-based idempotency within a server lifetime)
const sessions = new Map<string, UploadSession>();

export async function uploadMedia(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  idempotencyKey: string,
  btlDays = CONFIG.DEFAULT_BTL_DAYS,
): Promise<{ success: true; media_id: string } | { success: false; error: string }> {
  if (fileBuffer.length > CONFIG.MAX_FILE_SIZE) {
    return { success: false, error: `File too large. Max size: ${CONFIG.MAX_FILE_SIZE} bytes` };
  }

  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType)) {
    return { success: false, error: "Only JPEG, PNG, WebP, and GIF files are supported" };
  }

  // Idempotency: return same media_id if already uploaded with this key
  const existing = sessions.get(idempotencyKey);
  if (existing?.completed) {
    return { success: true, media_id: existing.media_id };
  }

  const media_id = ChunkingService.generateMediaId();
  const expiration_block = storage.calculateExpirationBlock(btlDays);

  const metadata = ChunkingService.createMetadata(
    media_id,
    filename,
    contentType,
    fileBuffer,
    btlDays,
    expiration_block,
  );

  const session: UploadSession = {
    media_id,
    idempotency_key: idempotencyKey,
    metadata,
    chunks_received: new Set(),
    completed: false,
  };
  sessions.set(idempotencyKey, session);

  try {
    const chunks = ChunkingService.chunkFile(fileBuffer, media_id, expiration_block);
    for (const chunk of chunks) {
      await storage.storeChunk(chunk);
      session.chunks_received.add(chunk.chunk_index);
    }
    await storage.storeMetadata(metadata);
    session.completed = true;
    return { success: true, media_id };
  } catch (err) {
    sessions.delete(idempotencyKey);
    return { success: false, error: `Upload failed: ${err}` };
  }
}

export async function getMedia(
  media_id: string,
): Promise<
  | { success: true; buffer: Buffer; metadata: MediaMetadata }
  | { success: false; error: string }
> {
  const metadata = await storage.getMetadata(media_id);
  if (!metadata) {
    return { success: false, error: "Media not found or expired" };
  }

  const chunks = await storage.getAllChunks(media_id);
  if (chunks.length === 0) {
    return { success: false, error: "Media chunks not found or incomplete" };
  }

  const chunkEntities = chunks.map((chunk) => ({
    id: "",
    media_id: chunk.media_id,
    chunk_index: chunk.chunk_index,
    data:
      typeof chunk.data === "string"
        ? Buffer.from(chunk.data, "base64")
        : Buffer.from(chunk.data),
    checksum: chunk.checksum,
    created_at: new Date(),
    expiration_block: chunk.expiration_block,
  }));

  const buffer = ChunkingService.reassembleFile(chunkEntities);

  if (!ChunkingService.validateFileIntegrity(metadata.checksum, buffer)) {
    return { success: false, error: "File integrity check failed" };
  }

  return { success: true, buffer, metadata };
}
