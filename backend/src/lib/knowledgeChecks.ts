import type { AdminClient } from "./supabase.js";
import type {
  KnowledgeCheckDto,
  KnowledgeCheckSession,
} from "../interfaces/knowledgeCheck.js";
import type { ReadingLevel } from "../models/assessment.js";
import { getProfile } from "./profile.js";
import { LanguageNotSelected } from "./assessment.js";

export class NoSuchCheck extends Error {}

const LEVELS: ReadingLevel[] = [
  "Starter",
  "Beginner",
  "Developing",
  "Intermediate",
];

function levelFor(difficulty: number): ReadingLevel {
  return LEVELS[Math.max(0, Math.min(3, difficulty - 1))]!;
}

function humanize(concept: string): string {
  const words = concept.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface CheckItemRow {
  difficulty: number;
  metadata: { concepts?: string[] };
}

async function learningLanguage(
  client: AdminClient,
  authUserId: string,
): Promise<{ profileId: string; languageId: string }> {
  const profile = await getProfile(client, authUserId);
  if (!profile?.learning_language_id) throw new LanguageNotSelected();
  return { profileId: profile.id, languageId: profile.learning_language_id };
}

export async function listChecks(
  client: AdminClient,
  authUserId: string,
): Promise<KnowledgeCheckDto[]> {
  const { languageId } = await learningLanguage(client, authUserId);
  const { data, error } = await client
    .from("assessment_item")
    .select("difficulty, metadata")
    .eq("language_id", languageId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  const rows = data as CheckItemRow[];
  const byDifficulty = new Map<
    number,
    { topics: Set<string>; count: number }
  >();
  for (const row of rows) {
    const entry = byDifficulty.get(row.difficulty) ?? {
      topics: new Set<string>(),
      count: 0,
    };
    entry.count += 1;
    for (const concept of Array.isArray(row.metadata?.concepts)
      ? row.metadata.concepts
      : [])
      entry.topics.add(humanize(concept));
    byDifficulty.set(row.difficulty, entry);
  }
  return [...byDifficulty.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([difficulty, entry]) => ({
      difficulty,
      level: levelFor(difficulty),
      topics: [...entry.topics].sort(),
      itemCount: entry.count,
    }));
}

export async function startCheck(
  client: AdminClient,
  authUserId: string,
  difficulty: number,
): Promise<KnowledgeCheckSession> {
  const { profileId, languageId } = await learningLanguage(client, authUserId);
  const available = await client
    .from("assessment_item")
    .select("item_key", { count: "exact", head: true })
    .eq("language_id", languageId)
    .eq("active", true)
    .eq("difficulty", difficulty);
  if (available.error) throw new Error(available.error.message);
  if ((available.count ?? 0) === 0) throw new NoSuchCheck();

  const existing = await client
    .from("assessment")
    .select("id")
    .eq("user_id", profileId)
    .eq("language_id", languageId)
    .eq("kind", "knowledge_check")
    .eq("focus_difficulty", difficulty)
    .eq("status", "in_progress")
    .limit(1);
  if (existing.error) throw new Error(existing.error.message);
  let assessmentId = (existing.data as { id: string }[])[0]?.id;
  if (!assessmentId) {
    const created = await client
      .from("assessment")
      .insert({
        user_id: profileId,
        language_id: languageId,
        status: "in_progress",
        kind: "knowledge_check",
        focus_difficulty: difficulty,
      })
      .select("id")
      .single();
    if (created.error) throw new Error(created.error.message);
    assessmentId = (created.data as { id: string }).id;
  }

  const language = await client
    .from("language")
    .select("name")
    .eq("id", languageId)
    .maybeSingle();
  if (language.error) throw new Error(language.error.message);
  return {
    assessmentId,
    languageName: (language.data as { name: string } | null)?.name ?? "",
    level: levelFor(difficulty),
  };
}
