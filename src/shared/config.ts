export type AppEnv = "local" | "test" | "staging" | "production";
export type NodeEnv = "development" | "test" | "production";

export interface AppConfig {
  appName: string;
  appEnv: AppEnv;
  nodeEnv: NodeEnv;
  port: number;
  apiPrefix: string;
  appUrl: string;
  pwaUrl: string;
}

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  passwordHashCost: number;
}

export interface SecurityConfig {
  corsAllowedOrigins: string[];
}

export interface RuntimeConfig {
  app: AppConfig;
  auth: AuthConfig;
  security: SecurityConfig;
  database: {
    databaseUrl: string;
    directDatabaseUrl: string | null;
  };
  observability: {
    requestIdHeader: string;
  };
}

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment configuration: ${issues.join(", ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

const allowedAppEnv: AppEnv[] = ["local", "test", "staging", "production"];
const allowedNodeEnv: NodeEnv[] = ["development", "test", "production"];

export function loadConfig(env: Record<string, string | undefined> = process.env): RuntimeConfig {
  const issues: string[] = [];

  const appName = requiredString(env, "APP_NAME", issues);
  const appEnv = requiredEnum(env, "APP_ENV", allowedAppEnv, issues);
  const nodeEnv = requiredEnum(env, "NODE_ENV", allowedNodeEnv, issues);
  const port = requiredPort(env, "PORT", issues);
  const apiPrefix = requiredString(env, "API_PREFIX", issues);
  const appUrl = requiredAbsoluteUrl(env, "APP_URL", issues);
  const pwaUrl = requiredAbsoluteUrl(env, "PWA_URL", issues);

  const databaseUrl = requiredDatabaseUrl(env, "DATABASE_URL", issues);
  const directDatabaseUrl = optionalDatabaseUrl(env, "DIRECT_DATABASE_URL", issues);

  const jwtAccessSecret = requiredSecret(env, "JWT_ACCESS_SECRET", 16, issues);
  const jwtAccessTtlSeconds = requiredPositiveInteger(env, "JWT_ACCESS_TTL_SECONDS", issues);
  const passwordHashCost = requiredIntegerRange(env, "PASSWORD_HASH_COST", 4, 31, issues);

  const corsAllowedOrigins = requiredCsvAbsoluteUrls(env, "CORS_ALLOWED_ORIGINS", issues);
  const requestIdHeader = requiredString(env, "REQUEST_ID_HEADER", issues);

  if (apiPrefix !== "" && !apiPrefix.startsWith("/")) {
    issues.push("API_PREFIX must start with '/'");
  }

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return {
    app: {
      appName,
      appEnv,
      nodeEnv,
      port,
      apiPrefix,
      appUrl,
      pwaUrl,
    },
    auth: {
      jwtAccessSecret,
      jwtAccessTtlSeconds,
      passwordHashCost,
    },
    security: {
      corsAllowedOrigins,
    },
    database: {
      databaseUrl,
      directDatabaseUrl,
    },
    observability: {
      requestIdHeader,
    },
  };
}

function requiredString(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): string {
  const value = env[key]?.trim();
  if (!value) {
    issues.push(`${key} is required`);
    return "";
  }

  return value;
}

function requiredEnum<T extends string>(
  env: Record<string, string | undefined>,
  key: string,
  allowed: readonly T[],
  issues: string[],
): T {
  const value = requiredString(env, key, issues);
  if (value === "") {
    return "" as T;
  }

  if (!allowed.includes(value as T)) {
    issues.push(`${key} must be one of: ${allowed.join(", ")}`);
    return "" as T;
  }

  return value as T;
}

function requiredPort(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): number {
  return requiredIntegerRange(env, key, 1, 65535, issues);
}

function requiredPositiveInteger(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): number {
  return requiredIntegerRange(env, key, 1, Number.MAX_SAFE_INTEGER, issues);
}

function requiredIntegerRange(
  env: Record<string, string | undefined>,
  key: string,
  min: number,
  max: number,
  issues: string[],
): number {
  const value = requiredString(env, key, issues);
  if (value === "") {
    return 0;
  }

  if (!/^-?\d+$/.test(value)) {
    issues.push(`${key} must be an integer`);
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  if (parsed < min || parsed > max) {
    issues.push(`${key} must be between ${min} and ${max}`);
    return 0;
  }

  return parsed;
}

function requiredAbsoluteUrl(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): string {
  const value = requiredString(env, key, issues);
  if (value === "") {
    return "";
  }

  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) {
      throw new Error("invalid protocol");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    issues.push(`${key} must be a valid absolute URL`);
    return "";
  }
}

function requiredCsvAbsoluteUrls(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): string[] {
  const value = requiredString(env, key, issues);
  if (value === "") {
    return [];
  }

  const urls = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    issues.push(`${key} must contain at least one origin`);
    return [];
  }

  const parsed: string[] = [];
  for (const item of urls) {
    try {
      const url = new URL(item);
      if (!url.protocol.startsWith("http")) {
        throw new Error("invalid protocol");
      }
      parsed.push(url.toString().replace(/\/$/, ""));
    } catch {
      issues.push(`${key} must contain valid absolute URLs`);
      return [];
    }
  }

  return parsed;
}

function requiredSecret(
  env: Record<string, string | undefined>,
  key: string,
  minLength: number,
  issues: string[],
): string {
  const value = requiredString(env, key, issues);
  if (value === "") {
    return "";
  }

  if (value.length < minLength) {
    issues.push(`${key} must be at least ${minLength} characters`);
    return "";
  }

  return value;
}

function requiredDatabaseUrl(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): string {
  const value = requiredString(env, key, issues);
  if (value === "") {
    return "";
  }

  if (!value.startsWith("postgresql://")) {
    issues.push(`${key} must start with postgresql://`);
    return "";
  }

  return value;
}

function optionalDatabaseUrl(
  env: Record<string, string | undefined>,
  key: string,
  issues: string[],
): string | null {
  const raw = env[key]?.trim();
  if (!raw) {
    return null;
  }

  if (!raw.startsWith("postgresql://")) {
    issues.push(`${key} must start with postgresql://`);
    return null;
  }

  return raw;
}
