export interface Config {
  environment: "development" | "preview" | "production";
  port: number;
  supabaseUrl: string;
  serviceRoleKey: string;
  corsOrigins: string[];
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const environment = env.APP_ENV ?? "development";
  if (!["development", "preview", "production"].includes(environment))
    throw new Error("Invalid APP_ENV");
  const port = Number(env.PORT ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey)
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const url = new URL(supabaseUrl);
  const local =
    environment === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new Error("Invalid Supabase URL");
  let role: unknown;
  try {
    role = (
      JSON.parse(
        Buffer.from(serviceRoleKey.split(".")[1] ?? "", "base64url").toString(),
      ) as { role?: unknown }
    ).role;
  } catch {
    /* Opaque secret keys are supported. */
  }
  // Decoding here only rejects accidental public keys; Auth performs token verification.
  if (!serviceRoleKey.startsWith("sb_secret_") && role !== "service_role")
    throw new Error(
      "A server-only Supabase secret/service-role key is required",
    );
  const corsOrigins = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const origin of corsOrigins) {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      !["http:", "https:"].includes(parsed.protocol) ||
      (environment !== "development" && parsed.protocol !== "https:")
    )
      throw new Error("CORS_ORIGINS must contain exact allowed origins");
  }
  return {
    environment: environment as Config["environment"],
    port,
    supabaseUrl: url.origin,
    serviceRoleKey,
    corsOrigins,
  };
}
