import { app } from "./app";
import { loadConfig } from "./shared/config";

export default app;
export { app };

if (import.meta.main) {
  try {
    const config = loadConfig();

    Bun.serve({
      fetch: app.fetch,
      port: config.app.port,
    });

    console.log(`Pulih API listening on http://localhost:${config.app.port}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid environment configuration");
    process.exit(1);
  }
}
