import type { RequestHandler } from "express";
import type { AdminClient } from "../lib/supabase.js";
export interface Identity {
  id: string;
}
export type VerifyToken = (token: string) => Promise<Identity | null>;
export class AuthUnavailable extends Error {}
export function tokenVerifier(client: AdminClient): VerifyToken {
  return async (token) => {
    try {
      const { data, error } = await client.auth.getUser(token);
      if (error) {
        if (!error.status || error.status >= 500 || error.status === 429)
          throw new AuthUnavailable();
        return null;
      }
      return data.user ? { id: data.user.id } : null;
    } catch (error) {
      if (error instanceof AuthUnavailable) throw error;
      throw new AuthUnavailable();
    }
  };
}
export function requireAuth(verify: VerifyToken): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    const match = header && /^Bearer ([^\s,]+)$/i.exec(header);
    if (!match?.[1] || match[1].length > 16384) {
      res.setHeader("WWW-Authenticate", "Bearer");
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const user = await verify(match[1]);
      if (!user) {
        res.setHeader("WWW-Authenticate", "Bearer");
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      res.locals.userId = user.id;
      next();
    } catch {
      res.status(503).json({ error: "authentication_unavailable" });
    }
  };
}
