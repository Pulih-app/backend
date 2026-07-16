import { createApp, type AppBindings, type AppEnv } from "./app";

function buildRuntimeEnv(env: Record<string, string | undefined> = process.env) {
  return env as AppEnv;
}

function buildRuntimeBindings(env: Record<string, unknown> = {}) {
  return env as AppBindings;
}

export default {
  fetch(request: Request, env: Record<string, unknown>, executionContext: any) {
    return createApp(buildRuntimeEnv(env as Record<string, string | undefined>), buildRuntimeBindings(env)).fetch(
      request,
      env,
      executionContext,
    );
  },
};

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp(buildRuntimeEnv());

  Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`Pulih API running on http://localhost:${port}`);
}
