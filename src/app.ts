import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createDatabaseHandle, type HyperdriveLike } from "./db/client";
import { createAuthRoutes } from "./modules/auth/auth.routes";
import type { AuthRepository } from "./modules/auth/auth.repository";
import { createUsersRoutes } from "./modules/users/users.routes";
import type { UsersRepository } from "./modules/users/users.repository";
import { createPsychologistsRoutes } from "./modules/psychologists/psychologists.routes";
import type { CredentialStorage, R2Like } from "./modules/psychologists/credential-storage";
import type { PsychologistsRepository } from "./modules/psychologists/psychologists.repository";
import { createBookingsRoutes } from "./modules/bookings/bookings.routes";
import type { BookingsRepository } from "./modules/bookings/bookings.repository";
import { createPaymentsRoutes } from "./modules/payments/payments.routes";
import { createRoutineRoutes } from "./modules/routine/routine.routes";
import type { RoutineRepository } from "./modules/routine/routine.repository";
import { createContentRoutes } from "./modules/content/content.routes";
import type { ContentRepository } from "./modules/content/content.repository";
import { createAiRoutes } from "./modules/ai/ai.routes";
import type { AiProvider } from "./modules/ai/ai-provider";
import type { AiRepository } from "./modules/ai/ai.repository";
import { buildOnboardingAnalysisMessages } from "./modules/ai/ai-safety";
import { parseOnboardingAnalysisResponse } from "./modules/ai/ai.service";
import type { AiAnalyzer } from "./modules/users/users.service";
import type { NotificationsService } from "./modules/notifications/notifications.service";
import { createHealthRoutes } from "./routes/health.routes";
import { createDocsRoutes } from "./routes/docs.routes";
import { validationDemoRoutes } from "./routes/validation-demo.routes";
import { loadConfig } from "./shared/config";
import { mapError } from "./shared/errors";
import {
  RESPONSE_MESSAGES,
  createErrorResponse,
  createSuccessResponse,
} from "./shared/response";
import { requestBaseline } from "./shared/middleware/request-baseline";

const DEFAULT_ENV = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "3000",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3000",
  PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "replace-with-strong-secret",
  JWT_ACCESS_TTL_SECONDS: "86400",
  PASSWORD_HASH_COST: "10",
  CORS_ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:4173",
  REQUEST_ID_HEADER: "x-request-id",
  PAKASIR_API_KEY: "local-pakasir-api-key",
  PAKASIR_PROVIDER_TIMEOUT_MS: "10000",
  AI_BASE_URL: "https://ai.sumopod.com/v1",
  AI_API_KEY: "local-ai-api-key",
  AI_MODEL: "gpt-4o-mini",
  AI_TIMEOUT_MS: "10000",
  AI_MAX_TOKENS: "800",
} as const;

export type AppEnv = Record<string, string | undefined>;
export type AppBindings = {
  HYPERDRIVE?: HyperdriveLike;
  CREDENTIAL_BUCKET?: R2Like;
};
export type AppOptions = {
  databaseHealthCheck?: () => Promise<void>;
  authRepository?: AuthRepository;
  usersRepository?: UsersRepository;
  psychologistsRepository?: PsychologistsRepository;
  bookingsRepository?: BookingsRepository;
  routineRepository?: RoutineRepository;
  contentRepository?: ContentRepository;
  aiRepository?: AiRepository;
  aiProvider?: AiProvider;
  credentialStorage?: CredentialStorage;
  notificationsService?: NotificationsService;
};

async function createDefaultDatabaseHealthCheck(env: AppEnv, bindings: AppBindings, config = loadConfig(env)) {
  const handle = await createDatabaseHandle({
    hyperdrive: bindings.HYPERDRIVE,
    databaseUrl: env.DATABASE_URL,
    directDatabaseUrl: env.DIRECT_DATABASE_URL,
  }, config);

  try {
    await handle.ping();
  } finally {
    await handle.close();
  }
}

function normalizeEnv(env: AppEnv = {}) {
  return {
    ...DEFAULT_ENV,
    ...env,
  };
}

function buildApp(env: AppEnv = DEFAULT_ENV, bindings: AppBindings = {}, options: AppOptions = {}) {
  const runtimeEnv = normalizeEnv(env);
  const app = new Hono<{ Variables: { requestId: string } }>();
  const config = loadConfig(runtimeEnv);
  const checkDatabase = options.databaseHealthCheck ?? (() => createDefaultDatabaseHealthCheck(runtimeEnv, bindings, config));

  app.use("*", requestBaseline({
    allowedOrigins: config.security.corsAllowedOrigins,
    requestIdHeader: config.security.requestIdHeader,
    bodyLimitBytes: 6 * 1024 * 1024,
  }));

  app.get("/health/live", (context) => {
    return context.json(
      createSuccessResponse({
        message: RESPONSE_MESSAGES.serviceIsLive,
        data: {
          status: "ok",
        },
      }),
    );
  });

  app.route("/health", createHealthRoutes({ checkDatabase }));
  app.route("/", createDocsRoutes(config));
  app.route("/api/v1", createAuthRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    repository: options.authRepository,
  }));
  const onboardingAiAnalyzer: AiAnalyzer | undefined = options.aiProvider ? {
    async analyzeOnboarding(input) {
      const provider = options.aiProvider!;
      const { messages } = buildOnboardingAnalysisMessages({ answers: input.answers as Record<string, unknown> });
      const response = await provider.complete({ messages, maxTokens: 500 });
      return parseOnboardingAnalysisResponse(response.content);
    },
  } : undefined;

  app.route("/api/v1", createUsersRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    usersRepository: options.usersRepository,
    aiAnalyzer: onboardingAiAnalyzer,
  }));
  app.route("/api/v1", createPsychologistsRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    psychologistsRepository: options.psychologistsRepository,
    credentialStorage: options.credentialStorage,
    credentialBucket: bindings.CREDENTIAL_BUCKET,
  }));
  app.route("/api/v1", createBookingsRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    bookingsRepository: options.bookingsRepository,
    notificationsService: options.notificationsService,
  }));
  app.route("/api/v1", createPaymentsRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    bookingsRepository: options.bookingsRepository,
    notificationsService: options.notificationsService,
  }));
  app.route("/api/v1", createRoutineRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    routineRepository: options.routineRepository,
  }));
  app.route("/api/v1", createContentRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    contentRepository: options.contentRepository,
  }));
  app.route("/api/v1", createAiRoutes({
    config,
    databaseSource: {
      hyperdrive: bindings.HYPERDRIVE,
      databaseUrl: runtimeEnv.DATABASE_URL,
      directDatabaseUrl: runtimeEnv.DIRECT_DATABASE_URL,
    },
    authRepository: options.authRepository,
    aiRepository: options.aiRepository,
    aiProvider: options.aiProvider,
  }));
  app.route("/api/v1", validationDemoRoutes);
  app.onError(handleGlobalError);

  return app;
}



export function handleGlobalError(error: Error | HTTPException | unknown, context: any) {
  const requestId = context.get("requestId") || context.req.header("x-request-id") || crypto.randomUUID();
  const mapped = mapError(error);

  return context.json(
    createErrorResponse({
      code: mapped.code,
      requestId,
      details: mapped.details,
      message: mapped.message,
    }),
    mapped.status,
  );
}

export const app = buildApp(DEFAULT_ENV);

export function createApp(env: AppEnv = DEFAULT_ENV, bindings: AppBindings = {}, options: AppOptions = {}) {
  return buildApp(env, bindings, options);
}
