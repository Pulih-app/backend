import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { CredentialStorageConfig } from "../../shared/config";
import type { CredentialStorage } from "./credential-storage";

export function createS3CredentialStorage(config: CredentialStorageConfig): CredentialStorage {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });

  return {
    async put({ key, file, metadata }) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        Metadata: metadata,
      });
      await client.send(command);
    },

    async getSignedUrl(key, expiresInSeconds = 3600) {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },
  };
}
