import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { routeInventory } from "../src/routes/api-route-inventory";
import { getOpenApiJson } from "../src/docs/openapi";

function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

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

function generateRoutesMarkdown() {
  const rows = routeInventory.map((item) => `| \`${item.method}\` | \`${item.path}\` | \`${item.auth}\` | ${item.mvp ? "Yes" : "No"} | \`${toOpenApiPath(item.path)}\` |`).join("\n");
  const lines = [
    "# Pulih Route Inventory",
    "",
    "Source of truth: `src/routes/api-route-inventory.ts`. OpenAPI operations are generated from this inventory and enriched in `src/docs/openapi.ts`.",
    "",
    "| Method | Runtime path | Auth | MVP | OpenAPI path |",
    "| ------ | ------------ | ---- | --- | ------------ |",
    rows,
    "",
  ];

  return `${lines.join("\n")}`;
}

const openApiYamlOutput = resolve("docs/generated/openapi.yaml");
const openApiJsonOutput = resolve("docs/generated/openapi.json");
const routesOutput = resolve("docs/generated/routes.md");
mkdirSync(dirname(openApiYamlOutput), { recursive: true });
const spec = getOpenApiJson();
writeFileSync(openApiYamlOutput, `${scalarYaml(spec).replace(/[ \t]+$/gm, "")}\n`, "utf8");
writeFileSync(openApiJsonOutput, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
writeFileSync(routesOutput, `${generateRoutesMarkdown()}\n`, "utf8");
console.log(`Wrote ${openApiYamlOutput}`);
console.log(`Wrote ${openApiJsonOutput}`);
console.log(`Wrote ${routesOutput}`);
