import { AppError, AppErrorCode } from "../../shared/errors";

export type R2Like = {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
};

export type CredentialStorage = {
  put(input: { key: string; file: File; metadata: Record<string, string> }): Promise<void>;
};

export function createCredentialStorage(bucket?: R2Like): CredentialStorage {
  return {
    async put(input) {
      if (!bucket) {
        throw new AppError(AppErrorCode.ServiceUnavailable, "Credential storage is not configured.");
      }
      await bucket.put(input.key, await input.file.arrayBuffer(), {
        httpMetadata: { contentType: input.file.type },
        customMetadata: input.metadata,
      });
    },
  };
}
