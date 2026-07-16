export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("CONFIG_VALIDATION_ERROR");
    this.name = "ConfigError";
    this.issues = issues;
  }
}

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
  };
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

  if (appEnv && !["local", "development", "staging", "production"].includes(appEnv)) {
    issues.push("APP_ENV must be one of local, development, staging, production");
  }

  if (apiPrefix && !apiPrefix.startsWith("/")) {
    issues.push("API_PREFIX must start with /");
  }

  if (!corsAllowedOrigins || corsAllowedOrigins.length === 0) {
    issues.push("CORS_ALLOWED_ORIGINS must contain at least one origin");
  }

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
    },
  };
}
