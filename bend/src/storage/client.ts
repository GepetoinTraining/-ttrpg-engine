// ============================================
// STORAGE CLIENT
// ============================================
//
// Frontend-friendly storage client for asset uploads.
//
// Usage:
//
//   import { StorageClient } from '@/storage';
//
//   const client = new StorageClient({
//     uploadUrl: '/api/storage/upload',
//     campaignId: 'xxx',
//   });
//
//   const result = await client.uploadMap(file, 'Battle Map');
//   console.log(result.url);
//

// ============================================
// TYPES
// ============================================

export type AssetType =
  | "map"
  | "portrait"
  | "handout"
  | "token"
  | "audio"
  | "video";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  type: AssetType;
  size: number;
  mimeType: string;
  metadata: Record<string, any>;
}

export interface StorageClientConfig {
  uploadUrl: string;
  campaignId: string;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
  maxFileSize?: number; // bytes
  allowedMimeTypes?: string[];
}

// ============================================
// DEFAULT CONFIGS
// ============================================

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ASSET_TYPE_MIME_TYPES: Record<AssetType, string[]> = {
  map: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  portrait: ["image/png", "image/jpeg", "image/webp"],
  handout: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ],
  token: ["image/png", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  video: ["video/mp4", "video/webm"],
};

// ============================================
// CLIENT CLASS
// ============================================

export class StorageClient {
  private config: Required<StorageClientConfig>;
  private abortController: AbortController | null = null;

  constructor(config: StorageClientConfig) {
    this.config = {
      maxFileSize: DEFAULT_MAX_FILE_SIZE,
      allowedMimeTypes: [],
      onProgress: () => {},
      onError: () => {},
      ...config,
    };
  }

  // ==========================================
  // UPLOAD METHODS
  // ==========================================

  async upload(
    file: File,
    type: AssetType,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<UploadResult> {
    // Validate
    this.validateFile(file, type);

    // Create form data
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("name", name);
    formData.append("campaignId", this.config.campaignId);

    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      const response = await this.uploadWithProgress(formData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    } finally {
      this.abortController = null;
    }
  }

  async uploadMap(
    file: File,
    name: string,
    gridSize?: number,
  ): Promise<UploadResult> {
    return this.upload(file, "map", name, { gridSize });
  }

  async uploadPortrait(
    file: File,
    name: string,
    entityType?: "character" | "npc" | "faction",
    entityId?: string,
  ): Promise<UploadResult> {
    return this.upload(file, "portrait", name, { entityType, entityId });
  }

  async uploadHandout(
    file: File,
    name: string,
    description?: string,
    isSecret?: boolean,
  ): Promise<UploadResult> {
    return this.upload(file, "handout", name, { description, isSecret });
  }

  async uploadToken(
    file: File,
    name: string,
    size:
      | "tiny"
      | "small"
      | "medium"
      | "large"
      | "huge"
      | "gargantuan" = "medium",
  ): Promise<UploadResult> {
    return this.upload(file, "token", name, { tokenSize: size });
  }

  async uploadAudio(
    file: File,
    name: string,
    category: "music" | "ambiance" | "sfx" = "music",
  ): Promise<UploadResult> {
    return this.upload(file, "audio", name, { category });
  }

  // ==========================================
  // UPLOAD WITH PROGRESS
  // ==========================================

  private async uploadWithProgress(formData: FormData): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          this.config.onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        resolve(
          new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers({
              "Content-Type":
                xhr.getResponseHeader("Content-Type") || "application/json",
            }),
          }),
        );
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload cancelled"));
      });

      // Handle abort controller
      if (this.abortController) {
        this.abortController.signal.addEventListener("abort", () => {
          xhr.abort();
        });
      }

      xhr.open("POST", this.config.uploadUrl);
      xhr.send(formData);
    });
  }

  // ==========================================
  // VALIDATION
  // ==========================================

  private validateFile(file: File, type: AssetType): void {
    // Check size
    if (file.size > this.config.maxFileSize) {
      const maxMB = Math.round(this.config.maxFileSize / 1024 / 1024);
      throw new Error(`File too large. Maximum size is ${maxMB}MB`);
    }

    // Check mime type
    const allowedTypes =
      this.config.allowedMimeTypes.length > 0
        ? this.config.allowedMimeTypes
        : ASSET_TYPE_MIME_TYPES[type];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed: ${allowedTypes.join(", ")}`);
    }
  }

  // ==========================================
  // CONTROL
  // ==========================================

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  static getAcceptString(type: AssetType): string {
    return ASSET_TYPE_MIME_TYPES[type].join(",");
  }

  static isValidMimeType(type: AssetType, mimeType: string): boolean {
    return ASSET_TYPE_MIME_TYPES[type].includes(mimeType);
  }

  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}

// ============================================
// SINGLETON FACTORY
// ============================================

let clientInstance: StorageClient | null = null;

export function getStorageClient(config?: StorageClientConfig): StorageClient {
  if (config) {
    clientInstance = new StorageClient(config);
  }
  if (!clientInstance) {
    throw new Error("Storage client not initialized");
  }
  return clientInstance;
}

export function initStorageClient(config: StorageClientConfig): StorageClient {
  clientInstance = new StorageClient(config);
  return clientInstance;
}
