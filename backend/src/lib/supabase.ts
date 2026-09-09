import { createClient } from "@supabase/supabase-js";
import type { Config } from "../config/env.js";
export function createAdminClient(config: Config) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
            : AbortSignal.timeout(10000),
        }),
    },
  });
}
export type AdminClient = ReturnType<typeof createAdminClient>;
