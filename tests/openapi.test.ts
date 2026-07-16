import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { getOpenApiJson } from "../src/docs/openapi";
import { routeInventory } from "../src/routes/api-route-inventory";

const generatedOpenApiPath = fileURLToPath(new URL("../docs/generated/openapi.json", import.meta.url));

function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

describe("openapi document", () => {
  test("covers runtime route inventory", () => {
    const spec = getOpenApiJson();
    const documentedPaths = Object.keys(spec.paths).sort();
    const runtimePaths = [...new Set(routeInventory.map((item) => toOpenApiPath(item.path)))].sort();

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Pulih API");
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(documentedPaths).toEqual(runtimePaths);
  });

  test("keeps generated artifact in sync", () => {
    const spec = getOpenApiJson();
    const generated = JSON.parse(readFileSync(generatedOpenApiPath, "utf8"));

    expect(generated).toEqual(spec);
  });

  test("keeps standard envelopes and examples", () => {
    const spec = getOpenApiJson();

    expect(spec.components.schemas.SuccessEnvelope).toBeTruthy();
    expect(spec.components.schemas.ErrorEnvelope).toBeTruthy();
    expect(spec.paths["/api/v1/auth/register"].post.requestBody.content["application/json"].examples.patient.value).toMatchObject({
      email: "patient@example.com",
    });
    expect(spec.paths["/api/v1/users/me"].get.responses["200"].content["application/json"].examples.success.value.data).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(spec.paths["/api/v1/users/me"].get.responses["404"].content["application/json"].examples.default.value.error).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(spec.paths["/api/v1/auth/register"].post.responses["409"].content["application/json"].examples.default.value.error.details[0]).toContain("email");
    expect(spec.paths["/api/v1/ai/ask-coach"].post.responses["429"].content["application/json"].examples.default.value.error.code).toBe("RATE_LIMITED");
    expect(spec.paths["/api/v1/bookings/{bookingId}/confirm"].post.responses["422"].content["application/json"].examples.default.value.error.code).toBe("VALIDATION_ERROR");
    expect(spec.components.schemas.Booking).toBeTruthy();
    expect(spec.components.schemas.RelapsePreventionPlan).toBeTruthy();
    expect(spec.paths["/api/v1/journals"].get).toBeTruthy();
    expect(spec.paths["/api/v1/journals"].post).toBeTruthy();
    expect(spec.paths["/api/v1/routine/relapses"].get).toBeTruthy();
    expect(spec.paths["/api/v1/routine/relapses"].post).toBeTruthy();
    expect(spec.paths["/docs/api"].get.responses["200"]).toBeTruthy();
    expect(spec.paths["/docs/api/"]?.get).toBeTruthy();
    expect(spec.paths["/openapi.yaml"].get).toBeTruthy();
  });
});
