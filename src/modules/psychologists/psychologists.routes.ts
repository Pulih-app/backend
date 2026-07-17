import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { AppError, AppErrorCode } from "../../shared/errors";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody, validateParams } from "../../shared/http/validation";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import type { CredentialStorage } from "./credential-storage";
import {
  credentialFileParamsSchema,
  psychologistBundleParamsSchema,
  psychologistProfileSchema,
  psychologistPublicParamsSchema,
  sessionBundleSchema,
  availabilityWindowSchema,
  validateDocumentType,
} from "./psychologists.schema";
import { createPsychologistsRepository, type PsychologistsRepository } from "./psychologists.repository";
import { createPsychologistsService, type PsychologistsService } from "./psychologists.service";

export type PsychologistsRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  authRepository?: AuthRepository;
  authService?: AuthService;
  psychologistsRepository?: PsychologistsRepository;
  credentialStorage?: CredentialStorage;
};

async function withService<T>(options: PsychologistsRoutesOptions, action: (service: PsychologistsService, authService: AuthService) => Promise<T>) {
  if (options.psychologistsRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createPsychologistsService(options.psychologistsRepository, options.credentialStorage), authService);
  }

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const authService = createAuthService(createAuthRepository(handle.db), options.config);
    return await action(createPsychologistsService(createPsychologistsRepository(handle.db), options.credentialStorage), authService);
  } finally {
    await handle.close();
  }
}

async function requireAuth(context: any, options: PsychologistsRoutesOptions, service: AuthService) {
  const middleware = authGuard({ service, config: options.config });
  await middleware(context, async () => undefined);
  return context.get("auth").user;
}

async function parseCredentialForm(context: any, service: PsychologistsService, userId: string) {
  const profile = await service.getProfile(userId);
  if (!profile) throw new AppError(AppErrorCode.Conflict, "Psychologist profile must be completed before uploading credentials.");

  const form = await context.req.formData();
  const file = form.get("file");
  const documentType = validateDocumentType(profile.type, form.get("documentType"));
  if (typeof documentType !== "string") {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", [`${documentType.field}: ${documentType.message}`]);
  }
  if (!(file instanceof File)) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["file: Credential file is required."]);
  }
  return { file, documentType };
}

export function createPsychologistsRoutes(options: PsychologistsRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/psychologists/register", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, psychologistProfileSchema);
    const profile = await service.upsertProfile(context.get("auth").user.id, payload);
    return context.json(createSuccessResponse({ message: "Psychologist profile saved successfully", data: profile }), 201);
  }));

  routes.get("/psychologists/me", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const profile = await service.getProfile(context.get("auth").user.id);
    return context.json(createSuccessResponse({ data: profile }));
  }));

  routes.put("/psychologists/me", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, psychologistProfileSchema);
    const profile = await service.upsertProfile(context.get("auth").user.id, payload);
    return context.json(createSuccessResponse({ message: "Psychologist profile updated successfully", data: profile }));
  }));

  routes.post("/psychologists/me/credential-file", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const { documentType, file } = await parseCredentialForm(context, service, context.get("auth").user.id);
    const result = await service.uploadCredentialFile(context.get("auth").user.id, documentType, file);
    return context.json(createSuccessResponse({ message: "Credential file uploaded successfully", data: result }), 201);
  }));

  routes.post("/psychologists/me/submit-for-review", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const profile = await service.submitForReview(context.get("auth").user.id);
    return context.json(createSuccessResponse({ message: "Psychologist profile submitted for review", data: profile }));
  }));

  routes.get("/psychologists/me/credential-file/:fileId/review-url", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const params = validateParams(context, credentialFileParamsSchema);
    const result = await service.getCredentialReviewUrl(context.get("auth").user.id, params.fileId);
    return context.json(createSuccessResponse({ data: result }));
  }));

  routes.post("/psychologists/me/bundles", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, sessionBundleSchema);
    const result = await service.createBundle(context.get("auth").user.id, payload);
    return context.json(createSuccessResponse({ message: "Session bundle created successfully", data: result }), 201);
  }));

  routes.post("/psychologists/me/availability-windows", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, availabilityWindowSchema);
    const result = await service.createAvailabilityWindow(context.get("auth").user.id, payload);
    return context.json(createSuccessResponse({ message: "Availability window created successfully", data: result }), 201);
  }));

  routes.put("/psychologists/me/bundles/:bundleId", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const params = validateParams(context, psychologistBundleParamsSchema);
    const payload = await validateJsonBody(context, sessionBundleSchema);
    const result = await service.updateBundle(context.get("auth").user.id, params.bundleId, payload);
    return context.json(createSuccessResponse({ message: "Session bundle updated successfully", data: result }));
  }));

  routes.delete("/psychologists/me/bundles/:bundleId", async (context) => withService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const params = validateParams(context, psychologistBundleParamsSchema);
    const result = await service.deleteBundle(context.get("auth").user.id, params.bundleId);
    return context.json(createSuccessResponse({ message: "Session bundle deleted successfully", data: result }));
  }));

  routes.get("/psychologists", async (context) => withService(options, async (service) => {
    const data = await service.getPublicDirectory();
    return context.json(createSuccessResponse({ data }));
  }));

  routes.get("/psychologist-sessions", async (context) => withService(options, async (service) => {
    const data = await service.listAllPublicSessions();
    return context.json(createSuccessResponse({ message: "Psychologist sessions retrieved successfully", data }));
  }));

  routes.get("/psychologists/:psychologistId", async (context) => withService(options, async (service) => {
    const params = validateParams(context, psychologistPublicParamsSchema);
    const data = await service.getPublicProfile(params.psychologistId);
    return context.json(createSuccessResponse({ data }));
  }));

  routes.get("/psychologists/:psychologistId/sessions", async (context) => withService(options, async (service) => {
    const params = validateParams(context, psychologistPublicParamsSchema);
    const data = await service.listPublicSessions(params.psychologistId);
    return context.json(createSuccessResponse({ data }));
  }));

  return routes;
}
