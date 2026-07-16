import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { validateJsonBody } from "../../shared/http/validation";
import { createSuccessResponse } from "../../shared/response";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { communityCommentSchema, communityPostSchema, communityReplySchema, journalSchema } from "./content.schema";
import { createContentRepository, type ContentRepository } from "./content.repository";
import { createContentService, type ContentService } from "./content.service";

export type ContentRoutesOptions = { config: AppConfig; databaseSource?: DatabaseSource; authRepository?: AuthRepository; authService?: AuthService; contentRepository?: ContentRepository };

async function withContentService<T>(options: ContentRoutesOptions, action: (service: ContentService, authService: AuthService) => Promise<T>) {
  if (options.contentRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createContentService(options.contentRepository), authService);
  }
  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    return await action(createContentService(createContentRepository(handle.db)), createAuthService(createAuthRepository(handle.db), options.config));
  } finally {
    await handle.close();
  }
}

async function requireAuth(context: any, options: ContentRoutesOptions, service: AuthService) {
  const middleware = authGuard({ service, config: options.config });
  await middleware(context, async () => undefined);
  return context.get("auth").user;
}

export function createContentRoutes(options: ContentRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.get("/journals", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Journals retrieved successfully", data: await service.listJournals(auth.id) }));
  }));

  routes.post("/journals", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, journalSchema);
    return context.json(createSuccessResponse({ message: "Journal created successfully", data: await service.createJournal(auth.id, payload) }), 201);
  }));

  // Community posts
  routes.get("/community", (context) => withContentService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    const category = context.req.query("category");
    return context.json(createSuccessResponse({ message: "Community posts retrieved successfully", data: await service.listCommunityPosts(category) }));
  }));

  routes.post("/community", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, communityPostSchema);
    return context.json(createSuccessResponse({ message: "Community post created successfully", data: await service.createCommunityPost(auth.id, payload) }), 201);
  }));

  // Community comments
  routes.get("/community/:postId/comments", (context) => withContentService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Community comments retrieved successfully", data: await service.listCommunityThread(context.req.param("postId")) }));
  }));

  routes.post("/community/:postId/comments", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, communityCommentSchema);
    return context.json(createSuccessResponse({ message: "Community comment created successfully", data: await service.createCommunityComment(auth.id, context.req.param("postId"), payload) }), 201);
  }));

  // Community replies
  routes.post("/community/:postId/comments/:commentId/replies", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, communityReplySchema);
    return context.json(createSuccessResponse({ message: "Community reply created successfully", data: await service.createCommunityReply(auth.id, context.req.param("postId"), context.req.param("commentId"), payload) }), 201);
  }));

  // Community like toggle
  routes.post("/community/:postId/like", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const result = await service.toggleCommunityLike(auth.id, context.req.param("postId"));
    return context.json(createSuccessResponse({ message: result.isLiked ? "Community post liked" : "Community post like removed", data: result }));
  }));

  routes.get("/education", (context) => withContentService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Education content retrieved successfully", data: await service.listEducation() }));
  }));

  routes.get("/content/daily", (context) => withContentService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Daily content retrieved successfully", data: await service.getDailyContent() }));
  }));

  routes.get("/achievements/catalog", (context) => withContentService(options, async (service, authService) => {
    await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Achievement catalog retrieved successfully", data: await service.listAchievementCatalog() }));
  }));

  routes.get("/achievements/progress", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Achievement progress retrieved successfully", data: await service.listAchievementProgress(auth.id) }));
  }));

  routes.get("/achievements/unlocked", (context) => withContentService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    return context.json(createSuccessResponse({ message: "Unlocked achievements retrieved successfully", data: await service.listUnlockedAchievements(auth.id) }));
  }));

  return routes;
}
