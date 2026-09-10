import express, { Router } from "express";
import type { Response } from "express";
import type { AdminClient } from "../lib/supabase.js";
import {
  LanguageNotSelected,
  readOnboarding,
  startOnboarding,
} from "../lib/assessment.js";
import {
  AssessmentForbidden,
  AssessmentNotFound,
  InvalidAnswer,
  ItemNotFound,
  nextQuestion,
  submitAnswer,
} from "../lib/assessmentDelivery.js";

function mapError(error: unknown, res: Response): void {
  if (error instanceof AssessmentForbidden) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (error instanceof AssessmentNotFound || error instanceof ItemNotFound) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (error instanceof InvalidAnswer) {
    res.status(400).json({ error: "invalid_answer" });
    return;
  }
  res.status(503).json({ error: "database_unavailable" });
}

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
  router.get("/:id/next", async (req, res) => {
    try {
      res.json(
        await nextQuestion(client, res.locals.userId as string, req.params.id),
      );
    } catch (error) {
      mapError(error, res);
    }
  });
  router.post(
    "/:id/answer",
    express.json({ limit: "4kb" }),
    async (req, res) => {
      const body = req.body as {
        itemId?: unknown;
        selectedOptionKey?: unknown;
      };
      const itemId = typeof body.itemId === "string" ? body.itemId : "";
      const selectedOptionKey =
        typeof body.selectedOptionKey === "string"
          ? body.selectedOptionKey
          : "";
      if (!itemId || !selectedOptionKey) {
        res.status(400).json({ error: "invalid_answer" });
        return;
      }
      try {
        res.json(
          await submitAnswer(
            client,
            res.locals.userId as string,
            req.params.id,
            itemId,
            selectedOptionKey,
          ),
        );
      } catch (error) {
        mapError(error, res);
      }
    },
  );
  return router;
}
