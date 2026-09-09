import { Router } from "express";
import type { AdminClient } from "../lib/supabase.js";
import { assessmentRoutes } from "./assessments.js";
import { onboardingRoutes } from "./onboarding.js";
export function apiRoutes(client: AdminClient) {
  const router = Router();
  router.use("/onboarding", onboardingRoutes(client));
  router.use("/assessments", assessmentRoutes(client));
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
  return router;
}
