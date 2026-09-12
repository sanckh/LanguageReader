import express, { Router } from "express";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import type { AdminClient } from "../lib/supabase.js";
import { assessmentRoutes } from "./assessments.js";
import { onboardingRoutes } from "./onboarding.js";
import { documentRoutes } from "./documents.js";
import { readIncludedOpening } from "../lib/documents.js";
import { computeReadingProfile } from "../lib/readingProfile.js";
import { bookSlug, fetchBook } from "../lib/wolneLektury.js";
import { getProviderCatalog, searchCatalog } from "../lib/providerCatalog.js";
import { getProfile } from "../lib/profile.js";
const compress = promisify(gzip);
export function apiRoutes(client: AdminClient) {
  const router = Router();
  router.use("/onboarding", onboardingRoutes(client));
  router.use("/assessments", assessmentRoutes(client));
  router.use("/documents", documentRoutes(client));
  router.get("/profile", async (_req, res) => {
    try {
      const profile = await computeReadingProfile(
        client,
        res.locals.userId as string,
      );
      res.json({ profile });
    } catch {
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  router.get("/me", async (_req, res) => {
    // Service role bypasses RLS: always derive ownership from verified identity.
    const userId = res.locals.userId as string;
    const { data, error } = await client
      .from("user_profile")
      .select("id, created_at")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (error) {
      res.status(503).json({ error: "database_unavailable" });
      return;
    }
    res.json({ userId, profile: data });
  });
  router.get("/me/files", async (_req, res) => {
    // Storage folders use Auth UUIDs; callers cannot supply another user's path.
    const { data, error } = await client.storage
      .from("my-library")
      .list(res.locals.userId as string, { limit: 100 });
    if (error) {
      res.status(503).json({ error: "storage_unavailable" });
      return;
    }
    res.json({ files: data.map(({ name, id }) => ({ name, id })) });
  });
  router.get("/library/provider", async (req, res) => {
    const query =
      typeof req.query.q === "string"
        ? req.query.q.trim().toLocaleLowerCase("pl")
        : "";
    if (query.length > 80) {
      res.status(400).json({ error: "invalid_query" });
      return;
    }
    try {
      const books = searchCatalog(await getProviderCatalog(), query);
      res.vary("Accept-Encoding");
      if (req.acceptsEncodings("gzip")) {
        const body = await compress(JSON.stringify({ books }));
        res.setHeader("Content-Encoding", "gzip");
        res.type("json").send(body);
      } else {
        res.json({ books });
      }
    } catch {
      res.status(503).json({ error: "provider_unavailable" });
    }
  });
  router.post(
    "/library/provider/import",
    express.json({ limit: "2kb" }),
    async (req, res) => {
      const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
      const level =
        req.body?.level === null || req.body?.level === undefined
          ? null
          : req.body.level;
      const topic =
        req.body?.topic === null || req.body?.topic === undefined
          ? null
          : req.body.topic;
      if (
        !slug ||
        (level !== null && ![1, 2, 3, 4].includes(level)) ||
        (topic !== null && typeof topic !== "string")
      ) {
        res.status(400).json({ error: "invalid_book" });
        return;
      }
      try {
        const privateLibrary = req.body?.scope === "private";
        if (
          req.body?.scope !== undefined &&
          !["private", "included"].includes(req.body.scope)
        ) {
          res.status(400).json({ error: "invalid_scope" });
          return;
        }
        const finish = async (id: string, status: number) => {
          if (privateLibrary) {
            const profile = await getProfile(
              client,
              res.locals.userId as string,
            );
            if (!profile) {
              res.status(403).json({ error: "profile_required" });
              return;
            }
            const saved = await client.rpc("save_provider_book", {
              source_id: id,
              learner_id: profile.id,
            });
            if (saved.error) throw saved.error;
            res.status(status).json({ book: { id: saved.data } });
          } else {
            const opening = await readIncludedOpening(client, id);
            res.status(status).json({ book: { id }, opening });
          }
        };
        const existing = await client
          .from("document")
          .select("id")
          .eq("provider", "wolne-lektury")
          .eq("provider_book_id", bookSlug(slug))
          .eq("is_included_library", true)
          .eq("status", "ready")
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) {
          await finish(existing.data.id, 200);
          return;
        }
        const prepared = await fetchBook({ book: slug, level, topic });
        const { data, error } = await client.rpc("import_wolne_lektury_book", {
          book: prepared.book,
          sections: prepared.sections,
          refresh: false,
        });
        if (error) throw error;
        await finish(data.id, 201);
      } catch {
        res.status(503).json({ error: "book_import_failed" });
      }
    },
  );
  return router;
}
