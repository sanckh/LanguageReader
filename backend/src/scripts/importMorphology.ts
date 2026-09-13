import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/env.js";
import { createAdminClient, type AdminClient } from "../lib/supabase.js";

// Loads the JSONL emitted by linguistics/analyze_tokens.py into the shared
// surface_form cache (with its lexemes). Idempotent: existing lexemes and surface
// forms are read once and only missing rows are inserted, so re-running after a
// corpus refresh adds new forms without duplicating old ones.

interface AnalysisRecord {
  form: string;
  lemma: string;
  pos: string | null;
  features: Record<string, string>;
}

interface LexemeRow {
  id: string;
  lemma: string;
  part_of_speech: string | null;
}

const PAGE = 1000;
const CHUNK = 200;

// Retry transient transport failures ("fetch failed": reset connection, timeout)
// so a single hiccup doesn't abort a long batch. Non-transient errors surface
// through the returned {error}, which callers still check.
async function run<T>(label: string, call: () => PromiseLike<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      last = error;
      const waitMs = 400 * attempt;
      console.warn(
        `${label} failed (attempt ${attempt}/4); retrying in ${waitMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw last;
}

function lexemeKey(lemma: string, pos: string | null): string {
  return `${lemma} ${pos ?? ""}`;
}

function stableFeatures(features: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(features).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  );
}

function parseRecords(text: string): AnalysisRecord[] {
  const records: AnalysisRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line) as Partial<AnalysisRecord>;
    if (typeof raw.form !== "string" || typeof raw.lemma !== "string")
      throw new Error(`Malformed record: ${line}`);
    const form = raw.form.trim();
    const lemma = raw.lemma.trim();
    if (!form || !lemma) continue;
    records.push({
      form,
      lemma,
      pos: typeof raw.pos === "string" && raw.pos ? raw.pos : null,
      features:
        raw.features && typeof raw.features === "object" ? raw.features : {},
    });
  }
  return records;
}

async function languageId(client: AdminClient, code: string): Promise<string> {
  const { data, error } = await run("language lookup", () =>
    client.from("language").select("id").eq("code", code).maybeSingle(),
  );
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(`Language "${code}" is not seeded; run migrations`);
  return (data as { id: string }).id;
}

async function loadLexemes(
  client: AdminClient,
  language: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run("load lexemes", () =>
      client
        .from("lexeme")
        .select("id, lemma, part_of_speech")
        .eq("language_id", language)
        .range(from, from + PAGE - 1),
    );
    if (error) throw new Error(error.message);
    const rows = data as LexemeRow[];
    for (const row of rows)
      map.set(lexemeKey(row.lemma, row.part_of_speech), row.id);
    if (rows.length < PAGE) break;
  }
  return map;
}

async function loadSurfaceKeys(
  client: AdminClient,
  lexemeIds: string[],
): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let i = 0; i < lexemeIds.length; i += CHUNK) {
    const slice = lexemeIds.slice(i, i + CHUNK);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await run("load surface forms", () =>
        client
          .from("surface_form")
          .select("lexeme_id, form_text, grammatical_features")
          .in("lexeme_id", slice)
          .range(from, from + PAGE - 1),
      );
      if (error) throw new Error(error.message);
      const rows = data as {
        lexeme_id: string;
        form_text: string;
        grammatical_features: Record<string, string> | null;
      }[];
      for (const row of rows)
        keys.add(
          `${row.lexeme_id} ${row.form_text} ${stableFeatures(row.grammatical_features ?? {})}`,
        );
      if (rows.length < PAGE) break;
    }
  }
  return keys;
}

async function insertLexemes(
  client: AdminClient,
  language: string,
  missing: { lemma: string; pos: string | null }[],
  map: Map<string, string>,
): Promise<void> {
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);
    const { data, error } = await run("insert lexemes", () =>
      client
        .from("lexeme")
        .insert(
          chunk.map((row) => ({
            language_id: language,
            lemma: row.lemma,
            part_of_speech: row.pos,
          })),
        )
        .select("id, lemma, part_of_speech"),
    );
    if (error) throw new Error(error.message);
    for (const row of data as LexemeRow[])
      map.set(lexemeKey(row.lemma, row.part_of_speech), row.id);
  }
}

async function insertSurfaceForms(
  client: AdminClient,
  rows: {
    lexeme_id: string;
    form_text: string;
    grammatical_features: Record<string, string>;
  }[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await run("insert surface forms", () =>
      client.from("surface_form").insert(rows.slice(i, i + CHUNK)),
    );
    if (error) throw new Error(error.message);
  }
}

async function main(): Promise<void> {
  const path = process.argv[2];
  const code = process.argv[3] ?? "pl";
  if (!path)
    throw new Error("Usage: import-morphology <analyses.jsonl> [language]");
  const records = parseRecords(await readFile(path, "utf8"));
  const client = createAdminClient(loadConfig());
  const language = await languageId(client, code);

  const lexemes = await loadLexemes(client, language);
  const missing = new Map<string, { lemma: string; pos: string | null }>();
  for (const record of records) {
    const key = lexemeKey(record.lemma, record.pos);
    if (!lexemes.has(key) && !missing.has(key))
      missing.set(key, { lemma: record.lemma, pos: record.pos });
  }
  await insertLexemes(client, language, [...missing.values()], lexemes);

  const existing = await loadSurfaceKeys(client, [...lexemes.values()]);
  const toInsert: {
    lexeme_id: string;
    form_text: string;
    grammatical_features: Record<string, string>;
  }[] = [];
  const staged = new Set<string>();
  for (const record of records) {
    const lexemeId = lexemes.get(lexemeKey(record.lemma, record.pos));
    if (!lexemeId) continue;
    const key = `${lexemeId} ${record.form} ${stableFeatures(record.features)}`;
    if (existing.has(key) || staged.has(key)) continue;
    staged.add(key);
    toInsert.push({
      lexeme_id: lexemeId,
      form_text: record.form,
      grammatical_features: record.features,
    });
  }
  await insertSurfaceForms(client, toInsert);

  console.log(
    `Imported ${missing.size} new lexemes and ${toInsert.length} new surface forms for "${code}"`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause)
    console.error("cause:", error.cause);
  process.exit(1);
});
