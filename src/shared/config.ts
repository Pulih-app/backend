export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("CONFIG_VALIDATION_ERROR");
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export type CredentialStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
};

export type AppConfig = {
  app: {
    appName: string;
    appEnv: string;
    nodeEnv: string;
    port: number;
    apiPrefix: string;
    appUrl: string;
    pwaUrl: string;
  };
  database: {
    databaseUrl: string;
    directDatabaseUrl: string;
    poolMax: number;
    poolIdleTimeoutMs: number;
  };
  security: {
    jwtAccessSecret: string;
    jwtAccessTtlSeconds: number;
    passwordHashCost: number;
    corsAllowedOrigins: string[];
    requestIdHeader: string;
  };
  payment: {
    pakasirProjectSlug: string;
    pakasirBaseUrl: string;
    pakasirPaymentBaseUrl: string;
    pakasirApiKey: string;
    pakasirProviderTimeoutMs: number;
  };
  email: {
    resendApiKey: string;
    resendFromEmail: string;
    resendFromName: string;
  };
  ai?: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    maxTokens: number;
  };
  credentialStorage?: CredentialStorageConfig;
};

function requireValue(issues: string[], key: string, value: string | undefined) {
  if (!value || value.trim().length === 0) {
    issues.push(`${key} is required`);
    return undefined;
  }

  return value.trim();
}

function parseNumber(issues: string[], key: string, value: string | undefined, minimum: number, maximum: number) {
  const raw = requireValue(issues, key, value);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    issues.push(`${key} must be an integer between ${minimum} and ${maximum}`);
    return undefined;
  }

  return parsed;
}

function parseUrl(issues: string[], key: string, value: string | undefined) {
  const raw = requireValue(issues, key, value);
  if (raw === undefined) {
    return undefined;
  }

  try {
    return new URL(raw).toString();
  } catch {
    issues.push(`${key} must be a valid URL`);
    return undefined;
  }
}

function normalizeAiModel(baseUrl: string, model: string) {
  if (baseUrl.includes("openrouter.ai") && model.startsWith("gpt-") && !model.includes("/")) {
    return `openai/${model}`;
  }

  return model;
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const issues: string[] = [];

  const appName = requireValue(issues, "APP_NAME", env.APP_NAME);
  const appEnv = requireValue(issues, "APP_ENV", env.APP_ENV);
  const nodeEnv = requireValue(issues, "NODE_ENV", env.NODE_ENV);
  const port = parseNumber(issues, "PORT", env.PORT, 1, 65535);
  const apiPrefix = requireValue(issues, "API_PREFIX", env.API_PREFIX);
  const appUrl = parseUrl(issues, "APP_URL", env.APP_URL);
  const pwaUrl = parseUrl(issues, "PWA_URL", env.PWA_URL);

  const databaseUrl = parseUrl(issues, "DATABASE_URL", env.DATABASE_URL);
  const directDatabaseUrl = parseUrl(issues, "DIRECT_DATABASE_URL", env.DIRECT_DATABASE_URL);
  const poolMax = env.DATABASE_POOL_MAX
    ? parseNumber(issues, "DATABASE_POOL_MAX", env.DATABASE_POOL_MAX, 1, 100)
    : 10;
  const poolIdleTimeoutMs = env.DATABASE_POOL_IDLE_TIMEOUT_MS
    ? parseNumber(issues, "DATABASE_POOL_IDLE_TIMEOUT_MS", env.DATABASE_POOL_IDLE_TIMEOUT_MS, 1000, 300000)
    : 30000;

  const jwtAccessSecret = requireValue(issues, "JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET);
  const jwtAccessTtlSeconds = parseNumber(issues, "JWT_ACCESS_TTL_SECONDS", env.JWT_ACCESS_TTL_SECONDS, 300, 86400);
  const passwordHashCost = parseNumber(issues, "PASSWORD_HASH_COST", env.PASSWORD_HASH_COST, 4, 15);
  const corsAllowedOrigins = requireValue(issues, "CORS_ALLOWED_ORIGINS", env.CORS_ALLOWED_ORIGINS)
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestIdHeader = requireValue(issues, "REQUEST_ID_HEADER", env.REQUEST_ID_HEADER);
  const pakasirProjectSlug = env.PAKASIR_PROJECT_SLUG?.trim() || "pulih";
  const pakasirBaseUrl = env.PAKASIR_BASE_URL?.trim() || "https://app.pakasir.com";
  const pakasirPaymentBaseUrl = env.PAKASIR_PAYMENT_BASE_URL?.trim() || "https://app.pakasir.com";
  const pakasirApiKey = env.PAKASIR_API_KEY?.trim() || "local-pakasir-api-key";
  const pakasirProviderTimeoutMs = env.PAKASIR_PROVIDER_TIMEOUT_MS
    ? parseNumber(issues, "PAKASIR_PROVIDER_TIMEOUT_MS", env.PAKASIR_PROVIDER_TIMEOUT_MS, 500, 30000)
    : 10000;
  const resendApiKey = env.RESEND_API_KEY?.trim() || "local-resend-api-key";
  const resendFromEmail = env.RESEND_FROM_EMAIL?.trim() || "no-reply@salmanabdurrahman.web.id";
  const resendFromName = env.RESEND_FROM_NAME?.trim() || "Pulih";
  const aiBaseUrl = env.AI_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
  const aiApiKey = env.AI_API_KEY?.trim() || "local-ai-api-key";
  const aiModel = normalizeAiModel(aiBaseUrl, env.AI_MODEL?.trim() || "google/gemini-2.5-flash-lite");
  const aiTimeoutMs = env.AI_TIMEOUT_MS ? parseNumber(issues, "AI_TIMEOUT_MS", env.AI_TIMEOUT_MS, 500, 30000) : 10000;
  const aiMaxTokens = env.AI_MAX_TOKENS ? parseNumber(issues, "AI_MAX_TOKENS", env.AI_MAX_TOKENS, 64, 4000) : 800;

  if (appEnv && !["local", "development", "staging", "production"].includes(appEnv)) {
    issues.push("APP_ENV must be one of local, development, staging, production");
  }

  if (apiPrefix && !apiPrefix.startsWith("/")) {
    issues.push("API_PREFIX must start with /");
  }

  if (!corsAllowedOrigins || corsAllowedOrigins.length === 0) {
    issues.push("CORS_ALLOWED_ORIGINS must contain at least one origin");
  }

  const credentialStorageEndpoint = env.CREDENTIAL_STORAGE_ENDPOINT?.trim();
  const credentialStorageRegion = env.CREDENTIAL_STORAGE_REGION?.trim() || "auto";
  const credentialStorageBucket = env.CREDENTIAL_STORAGE_BUCKET?.trim();
  const credentialStorageAccessKey = env.CREDENTIAL_STORAGE_ACCESS_KEY?.trim();
  const credentialStorageSecretKey = env.CREDENTIAL_STORAGE_SECRET_KEY?.trim();

  const credentialStorage: CredentialStorageConfig | undefined =
    credentialStorageEndpoint && credentialStorageBucket && credentialStorageAccessKey && credentialStorageSecretKey
      ? {
          endpoint: credentialStorageEndpoint,
          region: credentialStorageRegion,
          bucket: credentialStorageBucket,
          accessKey: credentialStorageAccessKey,
          secretKey: credentialStorageSecretKey,
        }
      : undefined;

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return {
    app: {
      appName: appName as string,
      appEnv: appEnv as string,
      nodeEnv: nodeEnv as string,
      port: port as number,
      apiPrefix: apiPrefix as string,
      appUrl: appUrl as string,
      pwaUrl: pwaUrl as string,
    },
    database: {
      databaseUrl: databaseUrl as string,
      directDatabaseUrl: directDatabaseUrl as string,
      poolMax: poolMax as number,
      poolIdleTimeoutMs: poolIdleTimeoutMs as number,
    },
    security: {
      jwtAccessSecret: jwtAccessSecret as string,
      jwtAccessTtlSeconds: jwtAccessTtlSeconds as number,
      passwordHashCost: passwordHashCost as number,
      corsAllowedOrigins: corsAllowedOrigins as string[],
      requestIdHeader: requestIdHeader as string,
    },
    payment: {
      pakasirProjectSlug,
      pakasirBaseUrl,
      pakasirPaymentBaseUrl,
      pakasirApiKey,
      pakasirProviderTimeoutMs: pakasirProviderTimeoutMs as number,
    },
    email: {
      resendApiKey,
      resendFromEmail,
      resendFromName,
    },
    ai: {
      baseUrl: aiBaseUrl,
      apiKey: aiApiKey,
      model: aiModel,
      timeoutMs: aiTimeoutMs as number,
      maxTokens: aiMaxTokens as number,
    },
    credentialStorage,
  };
}
