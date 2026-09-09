import express, { Router } from "express";
import type { AdminClient } from "../lib/supabase.js";
import {
  InvalidLanguageSelection,
  readLanguageOnboarding,
  setLanguageSelection,
} from "../lib/languages.js";

export function onboardingRoutes(client: AdminClient) {
  const router = Router();
  router.get("/languages", async (_req, res) => {
    try {
      res.json(
        await readLanguageOnboarding(client, res.locals.userId as string),
      );
    } catch {
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  router.post(
    "/languages",
    express.json({ limit: "4kb" }),
    async (req, res) => {
      const body = req.body as {
        nativeCode?: unknown;
        learningCode?: unknown;
      };
      const nativeCode =
        typeof body.nativeCode === "string" ? body.nativeCode : "";
      const learningCode =
        typeof body.learningCode === "string" ? body.learningCode : "";
      if (!nativeCode || !learningCode) {
        res.status(400).json({ error: "invalid_language_selection" });
        return;
      }
      try {
        res.json(
          await setLanguageSelection(
            client,
            res.locals.userId as string,
            nativeCode,
            learningCode,
          ),
        );
      } catch (error) {
        if (error instanceof InvalidLanguageSelection) {
          res.status(400).json({ error: "invalid_language_selection" });
          return;
        }
        res.status(503).json({ error: "database_unavailable" });
      }
    },
  );
  return router;
}
