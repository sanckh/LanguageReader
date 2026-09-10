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
test("Express onboarding endpoints create, resume, and guard the assessment", async () => {
  const config = loadConfig({
    APP_ENV: "development",
    SUPABASE_URL: status.API_URL!,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY!,
  });
  const admin = createAdminClient(config);
  const server = createApp(config, admin).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const email = "onboarding-" + randomUUID() + "@example.test";
  const password = randomUUID() + "Aa9!";
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(created.error, null);
  const authId = created.data.user!.id;
  const userClient = createClient(config.supabaseUrl, status.ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await userClient.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null);
  const token = signed.data.session!.access_token;
  const authorized = { authorization: "Bearer " + token };
  const call = (method: string) =>
    fetch(base + "/api/assessments/onboarding", {
      method,
      headers: authorized,
    });
  const setLanguages = (nativeCode: string, learningCode: string) =>
    fetch(base + "/api/onboarding/languages", {
      method: "POST",
      headers: { ...authorized, "content-type": "application/json" },
      body: JSON.stringify({ nativeCode, learningCode }),
    });
  try {
    const optionsResponse = await fetch(base + "/api/onboarding/languages", {
      headers: authorized,
    });
    assert.equal(optionsResponse.status, 200);
    const onboarding = (await optionsResponse.json()) as {
      options: { native: { code: string }[]; learning: { code: string }[] };
      selection: { native: unknown; learning: unknown };
    };
    assert.deepEqual(
      onboarding.options.native.map((l) => l.code),
      ["en"],
    );
    assert.deepEqual(
      onboarding.options.learning.map((l) => l.code),
      ["pl"],
    );
    assert.equal(onboarding.selection.native, null);
    assert.equal(onboarding.selection.learning, null);

    // The assessment cannot start before a learning language is chosen.
    assert.equal((await call("POST")).status, 409);
    // Reversed roles are rejected.
    assert.equal((await setLanguages("pl", "en")).status, 400);

    const selected = (await (await setLanguages("en", "pl")).json()) as {
      native: { code: string };
      learning: { code: string; name: string };
    };
    assert.equal(selected.native.code, "en");
    assert.equal(selected.learning.code, "pl");

    const before = await call("GET");
    assert.equal(before.status, 200);
    assert.deepEqual(await before.json(), {
      state: "not_started",
      assessment: null,
    });
    const started = (await (await call("POST")).json()) as {
      state: string;
      assessment: {
        id: string;
        status: string;
        completedAt: string | null;
        language: { code: string };
      };
    };
    assert.equal(started.state, "in_progress");
    assert.equal(started.assessment.status, "in_progress");
    assert.equal(started.assessment.completedAt, null);
    assert.equal(started.assessment.language.code, "pl");
    const resumed = (await (await call("POST")).json()) as {
      assessment: { id: string };
    };
    assert.equal(resumed.assessment.id, started.assessment.id);
    const after = (await (await call("GET")).json()) as {
      state: string;
      assessment: { id: string; language: { code: string } };
    };
    assert.equal(after.state, "in_progress");
    assert.equal(after.assessment.id, started.assessment.id);
    assert.equal(after.assessment.language.code, "pl");
    for (const path of [
      "/api/onboarding/languages",
      "/api/assessments/onboarding",
    ]) {
      for (const method of ["GET", "POST"]) {
        assert.equal((await fetch(base + path, { method })).status, 401);
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const profile = await admin
      .from("user_profile")
      .select("id")
      .eq("auth_user_id", authId)
      .maybeSingle();
    const profileId = (profile.data as { id: string } | null)?.id;
    if (profileId) {
      await admin.from("assessment").delete().eq("user_id", profileId);
      await admin.from("user_profile").delete().eq("id", profileId);
    }
    await admin.auth.admin.deleteUser(authId);
  }
});
test("Express serves assessment items, evaluates answers, and enforces ownership", async () => {
  const config = loadConfig({
    APP_ENV: "development",
    SUPABASE_URL: status.API_URL!,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY!,
  });
  const admin = createAdminClient(config);
  const server = createApp(config, admin).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const made: {
    authId: string;
    profileId: string;
    token: string;
    label: string;
  }[] = [];
  let languageId = "";
  let assessmentId = "";
  async function makeUser(label: string) {
    const email = label + "-" + randomUUID() + "@example.test";
    const password = randomUUID() + "Aa9!";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    const authId = created.data.user!.id;
    const profile = await admin
      .from("user_profile")
      .insert({ auth_user_id: authId })
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
    const profileId = profile.data!.id as string;
    made.push({
      authId,
      profileId,
      token: signed.data.session!.access_token,
      label,
    });
    return { authId, profileId, token: signed.data.session!.access_token };
  }
  try {
    const owner = await makeUser("owner");
    const other = await makeUser("other");
    const language = await admin
      .from("language")
      .insert({ code: "zz-" + randomUUID().slice(0, 8), name: "Testish" })
      .select("id")
      .single();
    assert.equal(language.error, null);
    languageId = language.data!.id as string;
    const items = [
      {
        language_id: languageId,
        base_language_id: languageId,
        item_key: "zz.1",
        version: 1,
        item_type: "vocabulary_meaning",
        difficulty: 1,
        prompt: "dom",
        options: [
          { key: "a", text: "house" },
          { key: "b", text: "dog" },
        ],
        correct_option_key: "a",
      },
      {
        language_id: languageId,
        base_language_id: languageId,
        item_key: "zz.2",
        version: 1,
        item_type: "vocabulary_meaning",
        difficulty: 2,
        prompt: "kot",
        options: [
          { key: "a", text: "fish" },
          { key: "b", text: "cat" },
        ],
        correct_option_key: "b",
      },
    ];
    assert.equal(
      (await admin.from("assessment_item").insert(items)).error,
      null,
    );
    const assessment = await admin
      .from("assessment")
      .insert({ user_id: owner.profileId, language_id: languageId })
      .select("id")
      .single();
    assert.equal(assessment.error, null);
    assessmentId = assessment.data!.id as string;
    const authed = (path: string, init?: RequestInit) =>
      fetch(base + "/api/assessments/" + assessmentId + path, {
        ...init,
        headers: {
          authorization: "Bearer " + owner.token,
          "content-type": "application/json",
          ...init?.headers,
        },
      });

    // Adaptive order is not fixed, so answer whichever item is served.
    const correctKeyByItem: Record<string, string> = {
      "zz.1": "a",
      "zz.2": "b",
    };
    const served: string[] = [];
    let lastFinished = false;
    for (let step = 0; step < 5; step++) {
      const next = (await (await authed("/next")).json()) as {
        question: { itemId: string; options: { key: string }[] } | null;
        finished: boolean;
      };
      if (next.finished || !next.question) break;
      const question = next.question;
      assert.equal("correctOptionKey" in question, false);
      assert.ok(question.options.length >= 2);
      served.push(question.itemId);
      const key = correctKeyByItem[question.itemId] ?? "";
      const result = (await (
        await authed("/answer", {
          method: "POST",
          body: JSON.stringify({
            itemId: question.itemId,
            selectedOptionKey: key,
          }),
        })
      ).json()) as {
        correct: boolean;
        correctOptionKey: string;
        finished: boolean;
      };
      assert.equal(result.correct, true);
      assert.equal(result.correctOptionKey, key);
      lastFinished = result.finished;
    }
    assert.deepEqual([...served].sort(), ["zz.1", "zz.2"]);
    assert.equal(lastFinished, true);

    const done = (await (await authed("/next")).json()) as {
      question: unknown;
      finished: boolean;
    };
    assert.equal(done.question, null);
    assert.equal(done.finished, true);
    const completed = await admin
      .from("assessment")
      .select("status, completed_at")
      .eq("id", assessmentId)
      .single();
    assert.equal((completed.data as { status: string }).status, "completed");
    assert.ok((completed.data as { completed_at: string | null }).completed_at);

    // Invalid option key.
    assert.equal(
      (
        await authed("/answer", {
          method: "POST",
          body: JSON.stringify({ itemId: "zz.1", selectedOptionKey: "z" }),
        })
      ).status,
      400,
    );
    // Another user cannot touch this assessment.
    const forbidden = await fetch(
      base + "/api/assessments/" + assessmentId + "/next",
      { headers: { authorization: "Bearer " + other.token } },
    );
    assert.equal(forbidden.status, 403);
    // Unauthenticated is rejected before ownership.
    assert.equal(
      (await fetch(base + "/api/assessments/" + assessmentId + "/next")).status,
      401,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (assessmentId) {
      await admin
        .from("assessment_response")
        .delete()
        .eq("assessment_id", assessmentId);
      await admin.from("assessment").delete().eq("id", assessmentId);
    }
    if (languageId) {
      await admin
        .from("assessment_item")
        .delete()
        .eq("language_id", languageId);
      await admin.from("language").delete().eq("id", languageId);
    }
    for (const user of made) {
      await admin.from("user_profile").delete().eq("id", user.profileId);
      await admin.auth.admin.deleteUser(user.authId);
    }
  }
});
test("Completing an assessment seeds confidence and returns a reading profile", async () => {
  const config = loadConfig({
    APP_ENV: "development",
    SUPABASE_URL: status.API_URL!,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY!,
  });
  const admin = createAdminClient(config);
  const server = createApp(config, admin).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const suffix = randomUUID().slice(0, 8);
  const email = "profile-" + suffix + "@example.test";
  const password = randomUUID() + "Aa9!";
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(created.error, null);
  const authId = created.data.user!.id;
  const userClient = createClient(config.supabaseUrl, status.ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await userClient.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null);
  const authorized = {
    authorization: "Bearer " + signed.data.session!.access_token,
  };
  const json = <T>(path: string, init?: RequestInit) =>
    fetch(base + path, {
      ...init,
      headers: {
        ...authorized,
        "content-type": "application/json",
        ...init?.headers,
      },
    }).then((response) => response.json() as Promise<T>);
  let profileId = "";
  const itemKeys = ["profile.dom." + suffix, "profile.kot." + suffix];
  const lexemeIds: string[] = [];
  try {
    const languages = await fetch(base + "/api/onboarding/languages", {
      method: "POST",
      headers: { ...authorized, "content-type": "application/json" },
      body: JSON.stringify({ nativeCode: "en", learningCode: "pl" }),
    });
    assert.equal(languages.status, 200);
    const pl = await admin
      .from("language")
      .select("id")
      .eq("code", "pl")
      .single();
    const en = await admin
      .from("language")
      .select("id")
      .eq("code", "en")
      .single();
    const languageId = pl.data!.id as string;
    const baseLanguageId = en.data!.id as string;
    for (const lemma of ["dom-" + suffix, "kot-" + suffix]) {
      const lexeme = await admin
        .from("lexeme")
        .insert({ language_id: languageId, lemma })
        .select("id")
        .single();
      assert.equal(lexeme.error, null);
      lexemeIds.push(lexeme.data!.id as string);
    }
    const items = [
      {
        language_id: languageId,
        base_language_id: baseLanguageId,
        item_key: itemKeys[0],
        version: 1,
        item_type: "vocabulary_meaning",
        difficulty: 1,
        target_lexeme_id: lexemeIds[0],
        prompt: "dom",
        options: [
          { key: "a", text: "house" },
          { key: "b", text: "dog" },
        ],
        correct_option_key: "a",
      },
      {
        language_id: languageId,
        base_language_id: baseLanguageId,
        item_key: itemKeys[1],
        version: 1,
        item_type: "vocabulary_meaning",
        difficulty: 2,
        target_lexeme_id: lexemeIds[1],
        prompt: "kot",
        options: [
          { key: "a", text: "cat" },
          { key: "b", text: "fish" },
        ],
        correct_option_key: "a",
      },
    ];
    assert.equal(
      (await admin.from("assessment_item").insert(items)).error,
      null,
    );

    const start = await json<{ assessment: { id: string } }>(
      "/api/assessments/onboarding",
      { method: "POST" },
    );
    const assessmentId = start.assessment.id;
    for (let step = 0; step < 5; step++) {
      const next = await json<{
        question: { itemId: string } | null;
        finished: boolean;
      }>("/api/assessments/" + assessmentId + "/next");
      if (next.finished || !next.question) break;
      await json("/api/assessments/" + assessmentId + "/answer", {
        method: "POST",
        body: JSON.stringify({
          itemId: next.question.itemId,
          selectedOptionKey: "a",
        }),
      });
    }

    const profileRow = await admin
      .from("user_profile")
      .select("id")
      .eq("auth_user_id", authId)
      .single();
    profileId = profileRow.data!.id as string;
    const confidence = await admin
      .from("knowledge_confidence")
      .select("lexeme_id, confidence")
      .eq("user_id", profileId)
      .eq("language_id", languageId);
    assert.equal(confidence.error, null);
    assert.equal((confidence.data as unknown[]).length, 2);

    const profile = await json<{
      profile: { level: string; vocabularyKnown: number } | null;
    }>("/api/profile");
    assert.notEqual(profile.profile, null);
    assert.equal(profile.profile!.vocabularyKnown, 2);
    assert.ok(typeof profile.profile!.level === "string");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (profileId) {
      await admin.from("assessment_response").delete().in("item_id", itemKeys);
      await admin
        .from("knowledge_confidence")
        .delete()
        .eq("user_id", profileId);
      await admin.from("assessment").delete().eq("user_id", profileId);
    }
    await admin.from("assessment_item").delete().in("item_key", itemKeys);
    for (const lexemeId of lexemeIds) {
      await admin.from("lexeme").delete().eq("id", lexemeId);
    }
    if (profileId)
      await admin.from("user_profile").delete().eq("id", profileId);
    await admin.auth.admin.deleteUser(authId);
  }
});
