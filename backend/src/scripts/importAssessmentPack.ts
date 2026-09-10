import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/env.js";
import { createAdminClient, type AdminClient } from "../lib/supabase.js";
import { normalizePack, parsePack } from "../lib/assessmentPack.js";

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

async function findOrCreateLexeme(
  client: AdminClient,
  language: string,
  lemma: string,
): Promise<string> {
  const found = await client
    .from("lexeme")
    .select("id")
    .eq("language_id", language)
    .eq("lemma", lemma)
    .limit(1);
  if (found.error) throw new Error(found.error.message);
  const existing = (found.data as { id: string }[])[0];
  if (existing) return existing.id;
  const created = await client
    .from("lexeme")
    .insert({ language_id: language, lemma })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  return (created.data as { id: string }).id;
}

async function ensureMeaning(
  client: AdminClient,
  lexemeId: string,
  gloss: string,
): Promise<void> {
  const found = await client
    .from("meaning")
    .select("id")
    .eq("lexeme_id", lexemeId)
    .eq("gloss", gloss)
    .limit(1);
  if (found.error) throw new Error(found.error.message);
  if ((found.data as { id: string }[])[0]) return;
  const created = await client
    .from("meaning")
    .insert({ lexeme_id: lexemeId, gloss, source: "assessment-pack" });
  if (created.error) throw new Error(created.error.message);
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: import-assessment-pack <pack.json>");
  const pack = parsePack(JSON.parse(await readFile(path, "utf8")) as unknown);
  const config = loadConfig();
  const client = createAdminClient(config);
  const language = await languageId(client, pack.language);
  const baseLanguage = await languageId(client, pack.baseLanguage);
  const items = normalizePack(pack);
  for (const item of items) {
    let targetLexemeId: string | null = null;
    if (item.targetLemma) {
      targetLexemeId = await findOrCreateLexeme(
        client,
        language,
        item.targetLemma,
      );
      await ensureMeaning(client, targetLexemeId, item.correctText);
    }
    const { error } = await client.from("assessment_item").upsert(
      {
        language_id: language,
        base_language_id: baseLanguage,
        item_key: item.itemKey,
        version: item.version,
        item_type: item.itemType,
        difficulty: item.difficulty,
        target_lexeme_id: targetLexemeId,
        prompt: item.prompt,
        options: item.options,
        correct_option_key: item.correctOptionKey,
        metadata: item.metadata,
        active: true,
      },
      { onConflict: "language_id,item_key,version" },
    );
    if (error) throw new Error(error.message);
  }
  console.log(
    `Imported ${items.length} assessment items for ${pack.language} v${pack.version}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
