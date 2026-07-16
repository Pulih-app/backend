import { createApp } from "./app";

const app = createApp();

export default app;

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);

  Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`Pulih API running on http://localhost:${port}`);
}