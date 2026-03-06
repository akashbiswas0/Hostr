/**
 * Arkiv blockchain storage for image chunks and metadata.
 * Adapted from the imageDB service – runs inside Next.js API routes (server-only).
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicArkivClient,
  type WalletArkivClient,
} from "@arkiv-network/sdk";
import { kaolin } from "@arkiv-network/sdk/chains";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { eq } from "@arkiv-network/sdk/query";
import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { Entity } from "@arkiv-network/sdk";
import { ChunkEntity, MediaChunk, MediaMetadata } from "./types";

const BLOCK_TIME_SECONDS = 2;
const BLOCKS_PER_DAY = Math.floor(86400 / BLOCK_TIME_SECONDS);

type BlockTimingCache = {
  currentBlock: number;
  blockDuration: number;
  updatedAt: number;
};

function normalizePrivateKey(key?: string | null): Hex | null {
  if (!key) return null;
  const t = key.trim();
  if (!t) return null;
  return (t.startsWith("0x") ? t : `0x${t}`) as Hex;
}

class ImageStorage {
  private publicClient: PublicArkivClient;
  private walletClient: WalletArkivClient | null = null;
  private ownerAddress: Address | null = null;
  private blockTimingCache: BlockTimingCache | null = null;
  private ready: Promise<void>;

  constructor() {
    this.publicClient = createPublicClient({
      chain: kaolin,
      transport: http(kaolin.rpcUrls.default.http[0]),
    });
    this.ready = this.init();
  }

  private async init() {
    const privateKey = normalizePrivateKey(process.env.IMAGEDB_PRIVATE_KEY);
    if (privateKey) {
      const account = privateKeyToAccount(privateKey);
      this.ownerAddress = account.address;
      this.walletClient = createWalletClient({
        chain: kaolin,
        transport: http(kaolin.rpcUrls.default.http[0]),
        account,
      });
    } else if (process.env.IMAGEDB_OWNER_ADDRESS) {
      this.ownerAddress = process.env.IMAGEDB_OWNER_ADDRESS as Address;
    }
  }

  private async wallet(): Promise<WalletArkivClient> {
    await this.ready;
    if (!this.walletClient) throw new Error("IMAGEDB_PRIVATE_KEY is not configured");
    return this.walletClient;
  }

  private async owner(): Promise<Address> {
    await this.ready;
    if (!this.ownerAddress) throw new Error("IMAGEDB_PRIVATE_KEY or IMAGEDB_OWNER_ADDRESS is not configured");
    return this.ownerAddress;
  }

  private attr(entity: Entity, key: string): string | number | undefined {
    return entity.attributes.find((a) => a.key === key)?.value;
  }

  private async blockTiming(): Promise<BlockTimingCache> {
    const now = Date.now();
    if (this.blockTimingCache && now - this.blockTimingCache.updatedAt < 5_000) {
      return this.blockTimingCache;
    }
    try {
      const timing = await this.publicClient.getBlockTiming();
      this.blockTimingCache = {
        currentBlock: Number(timing.currentBlock),
        blockDuration: timing.blockDuration,
        updatedAt: now,
      };
    } catch {
      this.blockTimingCache = {
        currentBlock: Math.floor(Date.now() / (BLOCK_TIME_SECONDS * 1_000)),
        blockDuration: BLOCK_TIME_SECONDS,
        updatedAt: now,
      };
    }
    return this.blockTimingCache;
  }

  private async expiresInSeconds(targetBlock: number): Promise<number> {
    const t = await this.blockTiming();
    const delta = Math.max(targetBlock - t.currentBlock, 0);
    return Math.max(delta * t.blockDuration, t.blockDuration);
  }

  calculateExpirationBlock(btlDays: number): number {
    const currentBlockEst = Math.floor(Date.now() / (BLOCK_TIME_SECONDS * 1_000));
    return currentBlockEst + Math.floor(btlDays * BLOCKS_PER_DAY);
  }

  // ── Chunks ────────────────────────────────────────────────────────────────

  async storeChunk(chunk: ChunkEntity): Promise<void> {
    const wallet = await this.wallet();
    const expiresIn = await this.expiresInSeconds(chunk.expiration_block);
    const payload = chunk.data instanceof Buffer ? chunk.data : Buffer.from(chunk.data);

    await wallet.createEntity({
      payload,
      attributes: [
        { key: "media_id", value: chunk.media_id },
        { key: "type", value: "image_chunk" },
        { key: "chunk_index", value: chunk.chunk_index },
        { key: "checksum", value: chunk.checksum },
      ],
      contentType: "application/octet-stream",
      expiresIn,
    });
  }

  async getAllChunks(media_id: string): Promise<MediaChunk[]> {
    const ownerAddress = await this.owner();

    const queryResult = await this.publicClient
      .buildQuery()
      .ownedBy(ownerAddress)
      .where([eq("type", "image_chunk"), eq("media_id", media_id)])
      .withAttributes(true)
      .withMetadata(true)
      .withPayload(true)
      .limit(1000)
      .fetch();

    const chunks: MediaChunk[] = queryResult.entities.map((entity) => {
      const payload = entity.payload ? Buffer.from(entity.payload) : Buffer.alloc(0);
      return {
        media_id,
        chunk_index: Number(this.attr(entity, "chunk_index") ?? 0),
        data: payload.toString("base64"),
        checksum: String(this.attr(entity, "checksum") ?? ""),
        expiration_block: entity.expiresAtBlock ? Number(entity.expiresAtBlock) : 0,
      };
    });

    chunks.sort((a, b) => a.chunk_index - b.chunk_index);
    return chunks;
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async storeMetadata(metadata: MediaMetadata): Promise<void> {
    const wallet = await this.wallet();
    const expiresIn = await this.expiresInSeconds(metadata.expiration_block);

    const payload = jsonToPayload({
      media_id: metadata.media_id,
      filename: metadata.filename,
      content_type: metadata.content_type,
      file_size: metadata.file_size,
      chunk_count: metadata.chunk_count,
      checksum: metadata.checksum,
      created_at: metadata.created_at.toISOString(),
      expiration_block: metadata.expiration_block,
      btl_days: metadata.btl_days,
    });

    await wallet.createEntity({
      payload,
      attributes: [
        { key: "media_id", value: metadata.media_id },
        { key: "type", value: "image_metadata" },
        { key: "filename", value: metadata.filename },
        { key: "content_type", value: metadata.content_type },
      ],
      contentType: "application/json",
      expiresIn,
    });
  }

  async getMetadata(media_id: string): Promise<MediaMetadata | null> {
    const ownerAddress = await this.owner();

    const queryResult = await this.publicClient
      .buildQuery()
      .ownedBy(ownerAddress)
      .where([eq("type", "image_metadata"), eq("media_id", media_id)])
      .withAttributes(true)
      .withMetadata(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    const entity = queryResult.entities[0];
    if (!entity?.payload) return null;

    const json = JSON.parse(Buffer.from(entity.payload).toString("utf8"));
    return {
      media_id: json.media_id,
      filename: json.filename,
      content_type: json.content_type,
      file_size: json.file_size,
      chunk_count: json.chunk_count,
      checksum: json.checksum,
      created_at: new Date(json.created_at),
      expiration_block: json.expiration_block ?? (entity.expiresAtBlock ? Number(entity.expiresAtBlock) : 0),
      btl_days: json.btl_days,
    };
  }
}

// Singleton – shared across hot-reloaded API route invocations in dev
const globalStorage = globalThis as typeof globalThis & { _imageStorage?: ImageStorage };
if (!globalStorage._imageStorage) {
  globalStorage._imageStorage = new ImageStorage();
}
export const storage = globalStorage._imageStorage;
