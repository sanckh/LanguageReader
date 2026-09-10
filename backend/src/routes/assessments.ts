import express, { Router } from "express";
import type { Response } from "express";
import type { AdminClient } from "../lib/supabase.js";
import {
  LanguageNotSelected,
  readOnboarding,
  restartOnboarding,
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
import { listChecks, NoSuchCheck, startCheck } from "../lib/knowledgeChecks.js";

function mapError(error: unknown, res: Response): void {
  if (error instanceof AssessmentForbidden) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (
    error instanceof AssessmentNotFound ||
    error instanceof ItemNotFound ||
    error instanceof NoSuchCheck
  ) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (error instanceof InvalidAnswer) {
    res.status(400).json({ error: "invalid_answer" });
    return;
  }
  if (error instanceof LanguageNotSelected) {
    res.status(409).json({ error: "language_not_selected" });
    return;
  }
  res.status(503).json({ error: "database_unavailable" });
}

export function assessmentRoutes(client: AdminClient) {
  const router = Router();
  const userId = (res: Response) => res.locals.userId as string;

  router.get("/onboarding", async (_req, res) => {
    try {
      res.json(await readOnboarding(client, userId(res)));
    } catch {
      res.status(503).json({ error: "database_unavailable" });
    }
  });
  router.post("/onboarding", async (_req, res) => {
    try {
      res.json(await startOnboarding(client, userId(res)));
    } catch (error) {
      mapError(error, res);
    }
  });
  router.post("/onboarding/restart", async (_req, res) => {
    try {
      res.json(await restartOnboarding(client, userId(res)));
    } catch (error) {
      mapError(error, res);
    }
  });

  router.get("/checks", async (_req, res) => {
    try {
      res.json({ checks: await listChecks(client, userId(res)) });
    } catch (error) {
      mapError(error, res);
    }
  });
  router.post("/checks", express.json({ limit: "1kb" }), async (req, res) => {
    const body = req.body as { difficulty?: unknown };
    const difficulty =
      typeof body.difficulty === "number" && Number.isInteger(body.difficulty)
        ? body.difficulty
        : 0;
    if (difficulty < 1 || difficulty > 5) {
      res.status(400).json({ error: "invalid_difficulty" });
      return;
    }
    try {
      res.json(await startCheck(client, userId(res), difficulty));
    } catch (error) {
      mapError(error, res);
    }
  });

  router.get("/:id/next", async (req, res) => {
    try {
      res.json(await nextQuestion(client, userId(res), req.params.id));
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
            userId(res),
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
