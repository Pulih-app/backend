export type CredentialStorage = {
  put(input: { key: string; file: File; metadata: Record<string, string> }): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
};
