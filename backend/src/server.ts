import { loadConfig } from "./config/env.js";
import { createAdminClient } from "./lib/supabase.js";
import { createApp } from "./app.js";
const config = loadConfig();
const server = createApp(config, createAdminClient(config)).listen(
  config.port,
  "0.0.0.0",
  () => {
    console.log("Language Reader API listening", {
      port: config.port,
      environment: config.environment,
    });
  },
);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
