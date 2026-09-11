import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/env.js";
import { createAdminClient } from "../lib/supabase.js";
import { fetchBook, parseSelection } from "../lib/wolneLektury.js";

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith("--"));
  if (
    !path ||
    args.some(
      (arg) =>
        arg.startsWith("--") && !["--dry-run", "--refresh"].includes(arg),
    )
  )
    throw new Error(
      "Usage: import:library <selection.json> [--dry-run] [--refresh]",
    );
  const selection = parseSelection(
    JSON.parse(await readFile(path, "utf8")) as unknown,
  );
  const client = args.includes("--dry-run")
    ? null
    : createAdminClient(loadConfig());
  let failures = 0;
  for (const entry of selection) {
    try {
      const prepared = await fetchBook(entry);
      let action = "validated";
      if (client) {
        const { data, error } = await client.rpc("import_wolne_lektury_book", {
          book: prepared.book,
          sections: prepared.sections,
          refresh: args.includes("--refresh"),
        });
        if (error) throw new Error(error.message);
        action = String((data as { action: string }).action);
      }
      console.log(
        `${entry.book}: ${action} — ${prepared.sections.length} sections, ${prepared.book.word_count} words`,
      );
    } catch (error) {
      failures++;
      console.error(
        `${entry.book}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }
  if (failures) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Import failed");
  process.exitCode = 1;
});
