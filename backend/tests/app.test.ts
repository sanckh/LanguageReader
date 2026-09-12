import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createAdminClient } from "../src/lib/supabase.js";
import { createClient } from "@supabase/supabase-js";
const env = {
  APP_ENV: "development",
  SUPABASE_URL: "http://127.0.0.1:55321",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  CORS_ORIGINS: "http://localhost:8081",
};
test("private provider saves derive ownership from the authenticated profile", async () => {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        let data: unknown;
        if (url.pathname.endsWith("/document")) data = { id: "shared-book" };
        else if (url.pathname.endsWith("/user_profile")) {
          assert.equal(
            url.searchParams.get("auth_user_id"),
            "eq.verified-user",
          );
          data = { id: "verified-profile" };
        } else {
          assert.ok(url.pathname.endsWith("/rpc/save_provider_book"));
          assert.deepEqual(JSON.parse(String(init?.body)), {
            source_id: "shared-book",
            learner_id: "verified-profile",
          });
          data = "private-book";
        }
        return new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const server = createApp(loadConfig(env), client, async () => ({
    id: "verified-user",
  })).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/library/provider/import`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer valid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          slug: "sample",
          scope: "private",
          owner_id: "someone-else",
        }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { book: { id: "private-book" } });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("configuration fails closed without server credentials or valid origins", () => {
  for (const overrides of [
    { SUPABASE_SERVICE_ROLE_KEY: "" },
    { SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_public" },
    { APP_ENV: "production" },
    { PORT: "1.5" },
    { CORS_ORIGINS: "*" },
    { APP_ENV: "other" },
  ])
    assert.throws(() => loadConfig({ ...env, ...overrides }));
  assert.equal(loadConfig(env).port, 3001);
});
test("HTTP health, authorization, CORS and outage responses", async () => {
  const config = loadConfig(env);
  const tokens: string[] = [];
  const app = createApp(config, createAdminClient(config), async (token) => {
    tokens.push(token);
    if (token === "outage") throw Error("secret upstream details");
    return token === "valid" ? { id: "verified-user" } : null;
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.deepEqual(await health.json(), {
      status: "ok",
      environment: "development",
    });
    for (const authorization of [
      "",
      "Basic abc",
      "Bearer a b",
      "Bearer invalid",
    ]) {
      const response = await fetch(base + "/api/me", {
        headers: { authorization },
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    }
    assert.deepEqual(tokens, ["invalid"]);
    const outage = await fetch(base + "/api/me", {
      headers: { authorization: "Bearer outage" },
    });
    assert.equal(outage.status, 503);
    assert.deepEqual(await outage.json(), {
      error: "authentication_unavailable",
    });
    // An unknown /api route also passes through authentication.
    assert.equal((await fetch(base + "/api/missing")).status, 401);
    assert.equal(
      (
        await fetch(base + "/api/missing", {
          headers: { authorization: "Bearer valid" },
        })
      ).status,
      404,
    );
    const allowed = await fetch(base + "/health", {
      headers: { origin: "http://localhost:8081" },
    });
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      "http://localhost:8081",
    );
    assert.equal(
      (
        await fetch(base + "/health", {
          headers: { origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    const preflight = await fetch(base + "/api/me", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:8081",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });
    assert.equal(preflight.status, 204);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
