import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "../src/config/env.js";
import { createAdminClient } from "../src/lib/supabase.js";
import { createApp } from "../src/app.js";
const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = fileURLToPath(
  new URL(
    "../../supabase/node_modules/supabase/dist/supabase.js",
    import.meta.url,
  ),
);
const status = JSON.parse(
  execFileSync(process.execPath, [cli, "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
) as Record<string, string>;
assert.equal(new URL(status.API_URL!).origin, "http://127.0.0.1:55321");
test("Express verifies real Supabase tokens and scopes service-role database/storage reads", async () => {
  const config = loadConfig({
    APP_ENV: "development",
    SUPABASE_URL: status.API_URL!,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY!,
  });
  const admin = createAdminClient(config);
  const server = createApp(config, admin).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const users: {
    id: string;
    profileId: string;
    token: string;
    file: string;
  }[] = [];
  try {
    for (const label of ["a", "b"]) {
      const email = label + "-" + randomUUID() + "@example.test",
        password = randomUUID() + "Aa9!";
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.equal(created.error, null);
      const id = created.data.user!.id;
      const profile = await admin
        .from("user_profile")
        .insert({ auth_user_id: id })
        .select("id")
        .single();
      assert.equal(profile.error, null);
      const userClient = createClient(config.supabaseUrl, status.ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      assert.equal(signed.error, null);
      const file = label + "-" + randomUUID() + ".txt";
      assert.equal(
        (await admin.storage.from("my-library").upload(id + "/" + file, "test"))
          .error,
        null,
      );
      users.push({
        id,
        profileId: profile.data!.id as string,
        token: signed.data.session!.access_token,
        file,
      });
    }
    for (const user of users) {
      const me = await fetch(base + "/api/me?userId=someone-else", {
        headers: { authorization: "Bearer " + user.token },
      });
      assert.equal(me.status, 200);
      const body = (await me.json()) as {
        userId: string;
        profile: { id: string };
      };
      assert.equal(body.userId, user.id);
      assert.equal(body.profile.id, user.profileId);
      const response = await fetch(base + "/api/me/files?prefix=someone-else", {
        headers: { authorization: "Bearer " + user.token },
      });
      assert.equal(response.status, 200);
      const listing = (await response.json()) as { files: { name: string }[] };
      assert.deepEqual(
        listing.files.map((f) => f.name),
        [user.file],
      );
    }
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: users[0]!.id,
        role: "authenticated",
        aud: "authenticated",
        exp: 1,
        iss: config.supabaseUrl + "/auth/v1",
      }),
    ).toString("base64url");
    const expired =
      header +
      "." +
      payload +
      "." +
      createHmac("sha256", status.JWT_SECRET!)
        .update(header + "." + payload)
        .digest("base64url");
    for (const token of [
      "invalid",
      status.ANON_KEY!,
      expired,
      users[0]!.token.slice(0, -10) + "tampered",
    ]) {
      const denied = await fetch(base + "/api/me", {
        headers: { authorization: "Bearer " + token },
      });
      assert.equal(denied.status, 401);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const user of users) {
      await admin.storage
        .from("my-library")
        .remove([user.id + "/" + user.file]);
      await admin.from("user_profile").delete().eq("id", user.profileId);
      await admin.auth.admin.deleteUser(user.id);
    }
  }
});
