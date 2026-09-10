import express from "express";
import type { ErrorRequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import type { Config } from "./config/env.js";
import type { AdminClient } from "./lib/supabase.js";
import {
  requireAuth,
  tokenVerifier,
  type VerifyToken,
} from "./middleware/auth.js";
import { apiRoutes } from "./routes/api.js";
export function createApp(
  config: Config,
  client: AdminClient,
  verify: VerifyToken = tokenVerifier(client),
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !config.corsOrigins.includes(origin)) {
      res.status(403).json({ error: "origin_not_allowed" });
      return;
    }
    next();
  });
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ["GET", "HEAD", "OPTIONS", "POST"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", environment: config.environment });
  });
  app.use("/api", requireAuth(verify), apiRoutes(client));
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
  const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ error: "internal_error" });
  };
  app.use(errorHandler);
  return app;
}
