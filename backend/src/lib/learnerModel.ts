import type { AdminClient } from "./supabase.js";

const CORRECT_CONFIDENCE = 65;
const INCORRECT_CONFIDENCE = 20;

interface SeedableAssessment {
  id: string;
  user_id: string;
  language_id: string;
}

// Seeds a starting confidence per tested lexeme from the assessment answers.
// Upsert keeps it idempotent when the assessment is retaken.
export async function seedKnowledgeFromAssessment(
  client: AdminClient,
  assessment: SeedableAssessment,
): Promise<void> {
  const responses = await client
    .from("assessment_response")
    .select("item_id, correct")
    .eq("assessment_id", assessment.id);
  if (responses.error) throw new Error(responses.error.message);
  const rows = responses.data as { item_id: string; correct: boolean }[];
  if (rows.length === 0) return;
  const items = await client
    .from("assessment_item")
    .select("item_key, target_lexeme_id")
    .eq("language_id", assessment.language_id)
    .not("target_lexeme_id", "is", null);
  if (items.error) throw new Error(items.error.message);
  const lexemeByKey = new Map(
    (items.data as { item_key: string; target_lexeme_id: string }[]).map(
      (item) => [item.item_key, item.target_lexeme_id],
    ),
  );
  const confidenceByLexeme = new Map<string, number>();
  for (const row of rows) {
    const lexemeId = lexemeByKey.get(row.item_id);
    if (!lexemeId) continue;
    const value = row.correct ? CORRECT_CONFIDENCE : INCORRECT_CONFIDENCE;
    const previous = confidenceByLexeme.get(lexemeId);
    if (previous === undefined || value > previous)
      confidenceByLexeme.set(lexemeId, value);
  }
  if (confidenceByLexeme.size === 0) return;
  const seeds = [...confidenceByLexeme].map(([lexemeId, confidence]) => ({
    user_id: assessment.user_id,
    language_id: assessment.language_id,
    lexeme_id: lexemeId,
    confidence,
  }));
  const { error } = await client
    .from("knowledge_confidence")
    .upsert(seeds, { onConflict: "user_id,language_id,lexeme_id" });
  if (error) throw new Error(error.message);
}
