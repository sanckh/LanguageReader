import { Router } from "express";
import type { AdminClient } from "../lib/supabase.js";
import {
  LanguageNotSupported,
  analyzeToken,
  lookupMeanings,
} from "../lib/lexicon.js";

const LEMMA_MAX = 100;
const TOKEN_MAX = 100;
const CONTEXT_MAX = 2000;

export function languageRoutes(client: AdminClient) {
  const router = Router();
  router.get("/:code/analyze", async (req, res) => {
    const token =
      typeof req.query.token === "string" ? req.query.token.trim() : "";
    const context =
      typeof req.query.context === "string"
        ? req.query.context.slice(0, CONTEXT_MAX)
        : undefined;
    if (!token || token.length > TOKEN_MAX) {
      res.status(400).json({ error: "invalid_token" });
      return;
    }
    try {
      res.json(await analyzeToken(client, req.params.code, token, context));
    } catch (error) {
      if (error instanceof LanguageNotSupported) {
        res.status(404).json({ error: "language_not_supported" });
        return;
      }
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  router.get("/:code/meanings", async (req, res) => {
    const lemma =
      typeof req.query.lemma === "string" ? req.query.lemma.trim() : "";
    const pos = typeof req.query.pos === "string" ? req.query.pos.trim() : "";
    if (!lemma || lemma.length > LEMMA_MAX) {
      res.status(400).json({ error: "invalid_lemma" });
      return;
    }
    try {
      res.json(
        await lookupMeanings(client, req.params.code, lemma, pos || undefined),
      );
    } catch (error) {
      if (error instanceof LanguageNotSupported) {
        res.status(404).json({ error: "language_not_supported" });
        return;
      }
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  return router;
}
