import express, { Router } from "express";
import type { Response } from "express";
import type { AdminClient } from "../lib/supabase.js";
import {
  DocumentForbidden,
  DocumentNotFound,
  InvalidReadingPosition,
  readDocument,
  readDocumentMeta,
  readSections,
  saveReadingPosition,
} from "../lib/documents.js";

const SECTIONS_MAX = 200;

function intParam(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function mapError(error: unknown, res: Response): void {
  if (error instanceof DocumentForbidden) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (error instanceof DocumentNotFound) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (error instanceof InvalidReadingPosition) {
    res.status(400).json({ error: "invalid_position" });
    return;
  }
  res.status(503).json({ error: "database_unavailable" });
}

export function documentRoutes(client: AdminClient) {
  const router = Router();
  router.get("/:id/meta", async (req, res) => {
    try {
      res.json(
        await readDocumentMeta(
          client,
          res.locals.userId as string,
          req.params.id,
        ),
      );
    } catch (error) {
      mapError(error, res);
    }
  });
  router.get("/:id/sections", async (req, res) => {
    const from = intParam(req.query.from, 0);
    const limit = Math.min(
      Math.max(intParam(req.query.limit, 40), 1),
      SECTIONS_MAX,
    );
    try {
      const sections = await readSections(
        client,
        res.locals.userId as string,
        req.params.id,
        from,
        limit,
      );
      res.json({ sections });
    } catch (error) {
      mapError(error, res);
    }
  });
  router.get("/:id", async (req, res) => {
    try {
      res.json(
        await readDocument(client, res.locals.userId as string, req.params.id),
      );
    } catch (error) {
      mapError(error, res);
    }
  });
  router.put(
    "/:id/position",
    express.json({ limit: "1kb" }),
    async (req, res) => {
      const body = req.body as {
        sectionId?: unknown;
        characterOffset?: unknown;
      };
      const sectionId =
        typeof body.sectionId === "string" ? body.sectionId : "";
      const characterOffset =
        typeof body.characterOffset === "number" &&
        Number.isInteger(body.characterOffset) &&
        body.characterOffset >= 0
          ? body.characterOffset
          : -1;
      if (!sectionId || characterOffset < 0) {
        res.status(400).json({ error: "invalid_position" });
        return;
      }
      try {
        await saveReadingPosition(
          client,
          res.locals.userId as string,
          req.params.id,
          sectionId,
          characterOffset,
        );
        res.json({ ok: true });
      } catch (error) {
        mapError(error, res);
      }
    },
  );
  return router;
}
