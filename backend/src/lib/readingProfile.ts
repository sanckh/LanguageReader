import type { AdminClient } from "./supabase.js";
import type { ReadingProfileDto } from "../interfaces/profile.js";
import type { ReadingLevel } from "../models/assessment.js";
import { getProfile } from "./profile.js";

const LEVELS: ReadingLevel[] = [
  "Starter",
  "Beginner",
  "Developing",
  "Intermediate",
];
const CEFR = ["A1", "A2", "A2–B1", "B1"];
const KNOWN_THRESHOLD = 50;
const LEVEL_PASS_RATIO = 0.5;
const LEVEL_MIN_ATTEMPTS = 2;
const STRENGTH_RATIO = 0.67;
const DEVELOPING_RATIO = 0.5;

function humanize(concept: string): string {
  const words = concept.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function computeReadingProfile(
  client: AdminClient,
  authUserId: string,
): Promise<ReadingProfileDto | null> {
  const profile = await getProfile(client, authUserId);
  if (!profile?.learning_language_id) return null;
  const languageId = profile.learning_language_id;

  const language = await client
    .from("language")
    .select("name")
    .eq("id", languageId)
    .maybeSingle();
  if (language.error) throw new Error(language.error.message);

  const latest = await client
    .from("assessment")
    .select("id")
    .eq("user_id", profile.id)
    .eq("language_id", languageId)
    .eq("kind", "onboarding")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);
  if (latest.error) throw new Error(latest.error.message);
  const completed = (latest.data as { id: string }[])[0];
  if (!completed) return null;

  const responses = await client
    .from("assessment_response")
    .select("item_id, correct, difficulty_at_time")
    .eq("assessment_id", completed.id);
  if (responses.error) throw new Error(responses.error.message);
  const answers = responses.data as {
    item_id: string;
    correct: boolean;
    difficulty_at_time: number;
  }[];
  if (answers.length === 0) return null;

  const items = await client
    .from("assessment_item")
    .select("item_key, metadata")
    .eq("language_id", languageId);
  if (items.error) throw new Error(items.error.message);
  const conceptsByKey = new Map(
    (
      items.data as { item_key: string; metadata: { concepts?: string[] } }[]
    ).map((item) => [
      item.item_key,
      Array.isArray(item.metadata?.concepts) ? item.metadata.concepts : [],
    ]),
  );

  // Level = the highest difficulty band the learner passed (>=50% with at
  // least 2 attempts), so a single lucky hard answer can't inflate the result.
  const byBand = new Map<number, { correct: number; total: number }>();
  for (const answer of answers) {
    const entry = byBand.get(answer.difficulty_at_time) ?? {
      correct: 0,
      total: 0,
    };
    entry.total += 1;
    if (answer.correct) entry.correct += 1;
    byBand.set(answer.difficulty_at_time, entry);
  }
  let passedBand = 1;
  for (const [difficulty, stats] of [...byBand].sort((a, b) => a[0] - b[0]))
    if (
      stats.total >= LEVEL_MIN_ATTEMPTS &&
      stats.correct / stats.total >= LEVEL_PASS_RATIO
    )
      passedBand = difficulty;
  const levelIndex = Math.max(0, Math.min(3, passedBand - 1));

  const tally = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    for (const concept of conceptsByKey.get(answer.item_id) ?? []) {
      const entry = tally.get(concept) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answer.correct) entry.correct += 1;
      tally.set(concept, entry);
    }
  }
  const strengths: string[] = [];
  const developing: string[] = [];
  for (const [concept, entry] of tally) {
    const ratio = entry.correct / entry.total;
    if (ratio >= STRENGTH_RATIO) strengths.push(humanize(concept));
    else if (ratio <= DEVELOPING_RATIO) developing.push(humanize(concept));
  }

  const known = await client
    .from("knowledge_confidence")
    .select("lexeme_id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("language_id", languageId)
    .gte("confidence", KNOWN_THRESHOLD);
  if (known.error) throw new Error(known.error.message);

  return {
    languageName: (language.data as { name: string } | null)?.name ?? "",
    level: LEVELS[levelIndex]!,
    cefr: CEFR[levelIndex]!,
    vocabularyKnown: known.count ?? 0,
    strengths: strengths.slice(0, 4),
    developing: developing.slice(0, 4),
  };
}
