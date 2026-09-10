import type { AdminClient } from "./supabase.js";
import type { BandResult, ReadingProfileDto } from "../interfaces/profile.js";
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
// A concept needs this many observations (across the assessment, knowledge
// checks and retakes) before it is trustworthy enough to call a strength or a
// weak spot. Below it, the profile withholds judgement and grows with usage.
const CONCEPT_MIN_OBSERVATIONS = 3;

function humanize(concept: string): string {
  const words = concept.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function levelFor(difficulty: number): ReadingLevel {
  return LEVELS[Math.max(0, Math.min(3, difficulty - 1))]!;
}

interface Answer {
  item_id: string;
  correct: boolean;
  difficulty_at_time: number;
}

export async function computeReadingProfile(
  client: AdminClient,
  authUserId: string,
): Promise<ReadingProfileDto | null> {
  const profile = await getProfile(client, authUserId);
  if (!profile?.learning_language_id) return null;
  const languageId = profile.learning_language_id;

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

  const [language, latestResponses, allAssessments, items, known] =
    await Promise.all([
      client.from("language").select("name").eq("id", languageId).maybeSingle(),
      client
        .from("assessment_response")
        .select("item_id, correct, difficulty_at_time")
        .eq("assessment_id", completed.id),
      client
        .from("assessment")
        .select("id")
        .eq("user_id", profile.id)
        .eq("language_id", languageId),
      client
        .from("assessment_item")
        .select("item_key, metadata")
        .eq("language_id", languageId),
      client
        .from("knowledge_confidence")
        .select("lexeme_id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("language_id", languageId)
        .gte("confidence", KNOWN_THRESHOLD),
    ]);
  for (const result of [
    language,
    latestResponses,
    allAssessments,
    items,
    known,
  ])
    if (result.error) throw new Error(result.error.message);

  const answers = latestResponses.data as Answer[];
  if (answers.length === 0) return null;

  const conceptsByKey = new Map(
    (
      items.data as { item_key: string; metadata: { concepts?: string[] } }[]
    ).map((item) => [
      item.item_key,
      Array.isArray(item.metadata?.concepts) ? item.metadata.concepts : [],
    ]),
  );

  // Per-band breakdown of the most recent assessment (honest reporting).
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
  const bands: BandResult[] = [...byBand.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([difficulty, stats]) => ({
      level: levelFor(difficulty),
      correct: stats.correct,
      total: stats.total,
    }));

  // Level = highest band passed (>=50% with >=2 attempts): a single lucky hard
  // answer cannot inflate it.
  let passedBand = 1;
  for (const [difficulty, stats] of [...byBand].sort((a, b) => a[0] - b[0]))
    if (
      stats.total >= LEVEL_MIN_ATTEMPTS &&
      stats.correct / stats.total >= LEVEL_PASS_RATIO
    )
      passedBand = difficulty;
  const levelIndex = Math.max(0, Math.min(3, passedBand - 1));

  // Strengths/weak spots draw on ALL of the learner's answers for this language
  // (assessment + knowledge checks + retakes), gated by a minimum observation
  // count so we withhold judgement until there is enough signal.
  const assessmentIds = (allAssessments.data as { id: string }[]).map(
    (row) => row.id,
  );
  const cumulative = await client
    .from("assessment_response")
    .select("item_id, correct")
    .in("assessment_id", assessmentIds);
  if (cumulative.error) throw new Error(cumulative.error.message);
  const tally = new Map<string, { correct: number; total: number }>();
  for (const row of cumulative.data as { item_id: string; correct: boolean }[])
    for (const concept of conceptsByKey.get(row.item_id) ?? []) {
      const entry = tally.get(concept) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (row.correct) entry.correct += 1;
      tally.set(concept, entry);
    }
  const strengths: string[] = [];
  const developing: string[] = [];
  for (const [concept, entry] of tally) {
    if (entry.total < CONCEPT_MIN_OBSERVATIONS) continue;
    const ratio = entry.correct / entry.total;
    if (ratio >= STRENGTH_RATIO) strengths.push(humanize(concept));
    else if (ratio <= DEVELOPING_RATIO) developing.push(humanize(concept));
  }

  return {
    languageName: (language.data as { name: string } | null)?.name ?? "",
    level: LEVELS[levelIndex]!,
    cefr: CEFR[levelIndex]!,
    answered: answers.length,
    correct: answers.filter((answer) => answer.correct).length,
    vocabularyKnown: known.count ?? 0,
    bands,
    strengths: strengths.slice(0, 4),
    developing: developing.slice(0, 4),
    hasEnoughSignal: strengths.length > 0 || developing.length > 0,
  };
}
