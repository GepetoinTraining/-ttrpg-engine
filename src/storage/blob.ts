// ============================================
// STORAGE LAYER
// ============================================
//
// Asset storage using Vercel Blob.
//
// Asset types:
//   - Maps (battle maps, world maps)
//   - Portraits (character, NPC)
//   - Handouts (documents, letters, images)
//   - Tokens (combat tokens)
//

// ============================================
// TYPES
// ============================================

export type AssetType = "map" | "portrait" | "handout" | "token";

export interface AssetMetadata {
  id: string;
  type: AssetType;
  name: string;
  mimeType: string;
  size: number;
  campaignId: string;
  uploadedBy: string;
  uploadedAt: Date;

  // Optional metadata
  description?: string;
  tags?: string[];

  // For maps
  gridSize?: number;
  width?: number;
  height?: number;

  // For tokens
  tokenSize?: "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";
}

export interface UploadOptions {
  type: AssetType;
  name: string;
  campaignId: string;
  uploadedBy: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UploadResult {
  url: string;
  metadata: AssetMetadata;
}

export interface StorageConfig {
  token?: string; // BLOB_READ_WRITE_TOKEN
}

// ============================================
// BLOB CLIENT
// ============================================

export class BlobStorage {
  private token: string;

  constructor(config?: StorageConfig) {
    this.token = config?.token || process.env.BLOB_READ_WRITE_TOKEN || "";

    if (!this.token) {
      console.warn(
        "BLOB_READ_WRITE_TOKEN not set. Storage operations will fail.",
      );
    }
  }

  // ==========================================
  // UPLOAD
  // ==========================================

  async upload(
    file: Blob | Buffer | ReadableStream,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const { put } = await import("@vercel/blob");

    const filename = this.generateFilename(options);

    const blob = await put(filename, file, {
      access: "public",
      token: this.token,
      addRandomSuffix: true,
    });

    const metadata: AssetMetadata = {
      id: crypto.randomUUID(),
      type: options.type,
      name: options.name,
      mimeType: blob.contentType || "application/octet-stream",
      size: blob.size,
      campaignId: options.campaignId,
      uploadedBy: options.uploadedBy,
      uploadedAt: new Date(),
      description: options.description,
      tags: options.tags,
      ...options.metadata,
    };

    return {
      url: blob.url,
      metadata,
    };
  }

  async uploadFromUrl(
    sourceUrl: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const { put } = await import("@vercel/blob");

    const filename = this.generateFilename(options);

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch source: ${response.status}`);
    }

    const blob = await put(filename, response.body!, {
      access: "public",
      token: this.token,
      addRandomSuffix: true,
    });

    const metadata: AssetMetadata = {
      id: crypto.randomUUID(),
      type: options.type,
      name: options.name,
      mimeType: blob.contentType || "application/octet-stream",
      size: blob.size,
      campaignId: options.campaignId,
      uploadedBy: options.uploadedBy,
      uploadedAt: new Date(),
      description: options.description,
      tags: options.tags,
      ...options.metadata,
    };

    return {
      url: blob.url,
      metadata,
    };
  }

  // ==========================================
  // DELETE
  // ==========================================

  async delete(url: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(url, { token: this.token });
  }

  async deleteMany(urls: string[]): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(urls, { token: this.token });
  }

  // ==========================================
  // LIST
  // ==========================================

  async list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    blobs: Array<{
      url: string;
      pathname: string;
      size: number;
      uploadedAt: Date;
    }>;
    cursor?: string;
    hasMore: boolean;
  }> {
    const { list } = await import("@vercel/blob");

    const result = await list({
      token: this.token,
      prefix: options?.prefix,
      limit: options?.limit || 100,
      cursor: options?.cursor,
    });

    return {
      blobs: result.blobs.map((b) => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
      cursor: result.cursor,
      hasMore: result.hasMore,
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private generateFilename(options: UploadOptions): string {
    const sanitizedName = options.name
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "-")
      .replace(/-+/g, "-");

    return `${options.type}s/${options.campaignId}/${sanitizedName}`;
  }

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================

  async uploadMap(
    file: Blob | Buffer,
    campaignId: string,
    uploadedBy: string,
    name: string,
    gridSize?: number,
  ): Promise<UploadResult> {
    return this.upload(file, {
      type: "map",
      name,
      campaignId,
      uploadedBy,
      metadata: { gridSize },
    });
  }

  async uploadPortrait(
    file: Blob | Buffer,
    campaignId: string,
    uploadedBy: string,
    name: string,
  ): Promise<UploadResult> {
    return this.upload(file, {
      type: "portrait",
      name,
      campaignId,
      uploadedBy,
    });
  }

  async uploadHandout(
    file: Blob | Buffer,
    campaignId: string,
    uploadedBy: string,
    name: string,
    description?: string,
  ): Promise<UploadResult> {
    return this.upload(file, {
      type: "handout",
      name,
      campaignId,
      uploadedBy,
      description,
    });
  }

  async uploadToken(
    file: Blob | Buffer,
    campaignId: string,
    uploadedBy: string,
    name: string,
    tokenSize: AssetMetadata["tokenSize"] = "medium",
  ): Promise<UploadResult> {
    return this.upload(file, {
      type: "token",
      name,
      campaignId,
      uploadedBy,
      metadata: { tokenSize },
    });
  }

  async listCampaignAssets(
    campaignId: string,
    type?: AssetType,
  ): Promise<Array<{ url: string; pathname: string; size: number }>> {
    const prefix = type ? `${type}s/${campaignId}/` : undefined;

    const allBlobs: Array<{ url: string; pathname: string; size: number }> = [];
    let cursor: string | undefined;

    do {
      const result = await this.list({ prefix, cursor, limit: 100 });
      allBlobs.push(...result.blobs);
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    // If no type specified, filter to only this campaign
    if (!type) {
      return allBlobs.filter((b) => b.pathname.includes(`/${campaignId}/`));
    }

    return allBlobs;
  }
}

// ============================================
// SINGLETON
// ============================================

let storage: BlobStorage | null = null;

export function getStorage(config?: StorageConfig): BlobStorage {
  if (!storage) {
    storage = new BlobStorage(config);
  }
  return storage;
}

export function initStorage(config: StorageConfig): BlobStorage {
  storage = new BlobStorage(config);
  return storage;
}
