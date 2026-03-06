declare class ImageDB {
  constructor(baseUrl?: string);
  upload(
    file: File | Blob,
    options?: {
      idempotencyKey?: string;
      ttlDays?: number;
      userId?: string;
    },
  ): Promise<{ media_id: string; [key: string]: unknown }>;
  get(
    mediaId: string,
    options?: { asBlob?: boolean },
  ): Promise<Blob>;
  getQuota(userId?: string | null): Promise<unknown>;
}

export default ImageDB;
