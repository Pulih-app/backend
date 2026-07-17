import { createApp } from "./app";
import { loadConfig } from "./shared/config";
import { createS3CredentialStorage } from "./modules/psychologists/credential-storage-s3";

const env = process.env as Record<string, string | undefined>;
const config = loadConfig(env);
const credentialStorage = config.credentialStorage
  ? createS3CredentialStorage(config.credentialStorage)
  : undefined;

const app = createApp(env, {}, { credentialStorage });
const host = env.HOST ?? "0.0.0.0";
const port = Number(env.PORT ?? 3002);

const server = Bun.serve({
  hostname: host,
  port,
  fetch: (request) => app.fetch(request),
});

console.log(`Pulih API running on http://${server.hostname}:${server.port}`);
