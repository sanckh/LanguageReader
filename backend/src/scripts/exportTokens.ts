import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadConfig } from "../config/env.js";
import { createAdminClient, type AdminClient } from "../lib/supabase.js";

// Collects the distinct word forms that actually occur in a language's documents
// and writes them one per line, lowercased. This bounded token list is the input
// to the Morfeusz analysis job (linguistics/analyze_tokens.py), so we only
// analyse vocabulary the reader can encounter.

const PAGE = 500;
const WORD = /\p{L}[\p{L}\p{M}-]*/gu;

async function languageId(client: AdminClient, code: string): Promise<string> {
  const { data, error } = await client
    .from("language")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(`Language "${code}" is not seeded; run migrations`);
  return (data as { id: string }).id;
}

async function collectTokens(
  client: AdminClient,
  language: string,
): Promise<Set<string>> {
  const tokens = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("document_section")
      .select("body, document:document_id!inner(language_id)")
      .eq("document.language_id", language)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data as { body: string }[];
    for (const row of rows) {
      const matches = row.body.match(WORD);
      if (!matches) continue;
      for (const match of matches) tokens.add(match.toLocaleLowerCase("pl"));
    }
    if (rows.length < PAGE) break;
  }
  return tokens;
}

async function main(): Promise<void> {
  const outPath = process.argv[2];
  const code = process.argv[3] ?? "pl";
  if (!outPath) throw new Error("Usage: export-tokens <tokens.txt> [language]");
  const client = createAdminClient(loadConfig());
  const language = await languageId(client, code);
  const tokens = await collectTokens(client, language);
  const sorted = [...tokens].sort((a, b) => a.localeCompare(b, code));
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, sorted.join("\n") + "\n", "utf8");
  console.log(`Wrote ${sorted.length} distinct "${code}" tokens to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
