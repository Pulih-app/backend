import { Hono } from "hono";
import { getOpenApiJson } from "../docs/openapi";

const scalarHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pulih API Reference</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --panel: rgba(15, 23, 42, 0.86);
        --border: rgba(148, 163, 184, 0.22);
        --text: #e2e8f0;
        --muted: #94a3b8;
      }
      html, body { margin: 0; width: 100%; min-height: 100%; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { min-height: 100vh; }
      .shell { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
      .content { flex: 1; min-height: 0; }
      #scalar { min-height: 100vh; }
      .fallback { margin: 24px; padding: 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); color: var(--muted); }
      .fallback code { color: #fff; }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="content">
        <div id="scalar"></div>
        <noscript>
          <div class="fallback">Scalar docs need JavaScript. Open <code>/openapi.json</code> or <code>/openapi.yaml</code> directly if preview fails.</div>
        </noscript>
      </section>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      const init = () => {
        if (!window.Scalar) return setTimeout(init, 50)
        Scalar.createApiReference('#scalar', {
          url: '/openapi.json',
          title: 'Pulih API Reference',
          layout: 'modern',
          theme: 'deepSpace',
          darkMode: true,
          forceDarkModeState: 'dark',
          showSidebar: true,
          defaultOpenAllTags: true,
          expandAllResponses: true,
          expandAllSchemaProperties: true,
          expandAllModelSections: true,
          modelsSectionLabel: 'Schemas',
          orderSchemaPropertiesBy: 'preserve',
          orderRequiredPropertiesFirst: true,
          showOperationId: true,
          hideSearch: false,
          hideTestRequestButton: false,
          documentDownloadType: 'both',
          defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
          authentication: { preferredSecurityScheme: 'bearerAuth' },
        })
      }
      init()
    </script>
  </body>
</html>`;

function scalarYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "string") {
    if (value.includes("\n")) return `|\n${value.split("\n").map((line) => `${pad}  ${line}`).join("\n")}`;
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => {
      if (item && typeof item === "object") return `${pad}-\n${scalarYaml(item, indent + 1)}`;
      return `${pad}- ${scalarYaml(item, indent + 1).trimStart()}`;
    }).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries.map(([key, item]) => {
      const safeKey = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ? key : JSON.stringify(key);
      if (item && typeof item === "object") return `${pad}${safeKey}:\n${scalarYaml(item, indent + 1)}`;
      return `${pad}${safeKey}: ${scalarYaml(item, indent + 1)}`;
    }).join("\n");
  }
  return JSON.stringify(value);
}

function toYamlDocument() {
  return `${scalarYaml(getOpenApiJson()).replace(/[ \t]+$/gm, "")}\n`;
}

export function createDocsRoutes() {
  const routes = new Hono();

  routes.get("/openapi.yaml", (context) => context.text(toYamlDocument(), 200, { "Content-Type": "application/yaml; charset=utf-8" }));
  routes.get("/openapi.json", (context) => context.json(getOpenApiJson()));
  routes.get("/docs/api", (context) => context.html(scalarHtml));
  routes.get("/docs/api/", (context) => context.html(scalarHtml));

  return routes;
}
