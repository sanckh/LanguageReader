import { Router } from "express";
import type { AdminClient } from "../lib/supabase.js";
import {
  LanguageNotSelected,
  readOnboarding,
  startOnboarding,
} from "../lib/assessment.js";

export function assessmentRoutes(client: AdminClient) {
  const router = Router();
  router.get("/onboarding", async (_req, res) => {
    try {
      res.json(await readOnboarding(client, res.locals.userId as string));
    } catch {
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  router.post("/onboarding", async (_req, res) => {
    try {
      res.json(await startOnboarding(client, res.locals.userId as string));
    } catch (error) {
      if (error instanceof LanguageNotSelected) {
        res.status(409).json({ error: "language_not_selected" });
        return;
      }
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  return router;
}
