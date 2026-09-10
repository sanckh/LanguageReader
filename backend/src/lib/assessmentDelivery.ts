import type { AdminClient } from "./supabase.js";
import type {
  AnswerResult,
  AssessmentQuestion,
  AssessmentQuestionOption,
  NextQuestion,
} from "../interfaces/assessment.js";
import type { AssessmentItemType } from "../models/assessment.js";
import { getProfile } from "./profile.js";
import { seedKnowledgeFromAssessment } from "./learnerModel.js";

export class AssessmentNotFound extends Error {}
export class AssessmentForbidden extends Error {}
export class ItemNotFound extends Error {}
export class InvalidAnswer extends Error {}

const START_DIFFICULTY = 2;
const MAX_QUESTIONS = 12;
const MIN_FOR_EARLY_STOP = 8;
const HIGH_ACCURACY = 0.85;
const LOW_ACCURACY = 0.2;

interface AssessmentRow {
  id: string;
  user_id: string;
  language_id: string;
}

interface ItemRow {
  item_key: string;
  version: number;
  item_type: AssessmentItemType;
  difficulty: number;
  prompt: string;
  options: AssessmentQuestionOption[];
  correct_option_key: string;
}

interface Progress {
  answered: Set<string>;
  count: number;
  correct: number;
}

function shuffle(
  options: AssessmentQuestionOption[],
): AssessmentQuestionOption[] {
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// The running score walks a difficulty ladder; correct answers raise the
// target and skip easier items, wrong answers lower it. Order-independent so
// it can be recomputed from stored responses without a timestamp column.
function targetDifficulty(
  progress: Progress,
  min: number,
  max: number,
): number {
  const raw =
    START_DIFFICULTY + progress.correct - (progress.count - progress.correct);
  return Math.max(min, Math.min(max, raw));
}

function isFinished(progress: Progress, remaining: number): boolean {
  if (remaining === 0) return true;
  if (progress.count >= MAX_QUESTIONS) return true;
  if (progress.count >= MIN_FOR_EARLY_STOP) {
    const accuracy = progress.correct / progress.count;
    if (accuracy >= HIGH_ACCURACY || accuracy <= LOW_ACCURACY) return true;
  }
  return false;
}

async function ownedAssessment(
  client: AdminClient,
  authUserId: string,
  assessmentId: string,
): Promise<AssessmentRow> {
  const profile = await getProfile(client, authUserId);
  if (!profile) throw new AssessmentForbidden();
  const { data, error } = await client
    .from("assessment")
    .select("id, user_id, language_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AssessmentNotFound();
  const row = data as AssessmentRow;
  if (row.user_id !== profile.id) throw new AssessmentForbidden();
  return row;
}

async function progressOf(
  client: AdminClient,
  assessmentId: string,
): Promise<Progress> {
  const { data, error } = await client
    .from("assessment_response")
    .select("item_id, correct")
    .eq("assessment_id", assessmentId);
  if (error) throw new Error(error.message);
  const rows = data as { item_id: string; correct: boolean }[];
  return {
    answered: new Set(rows.map((row) => row.item_id)),
    count: rows.length,
    correct: rows.filter((row) => row.correct).length,
  };
}

async function activeItems(
  client: AdminClient,
  languageId: string,
): Promise<ItemRow[]> {
  const { data, error } = await client
    .from("assessment_item")
    .select(
      "item_key, version, item_type, difficulty, prompt, options, correct_option_key",
    )
    .eq("language_id", languageId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return data as ItemRow[];
}

function chooseItem(remaining: ItemRow[], target: number): ItemRow {
  return remaining.reduce((best, item) => {
    const closer =
      Math.abs(item.difficulty - target) < Math.abs(best.difficulty - target);
    const tie =
      item.difficulty === best.difficulty && item.item_key < best.item_key;
    const nearerTie =
      Math.abs(item.difficulty - target) ===
        Math.abs(best.difficulty - target) &&
      (item.difficulty < best.difficulty || tie);
    return closer || nearerTie ? item : best;
  });
}

async function markCompleted(
  client: AdminClient,
  assessmentId: string,
): Promise<void> {
  const { error } = await client
    .from("assessment")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", assessmentId)
    .eq("status", "in_progress");
  if (error) throw new Error(error.message);
}

export async function nextQuestion(
  client: AdminClient,
  authUserId: string,
  assessmentId: string,
): Promise<NextQuestion> {
  const assessment = await ownedAssessment(client, authUserId, assessmentId);
  const items = await activeItems(client, assessment.language_id);
  const progress = await progressOf(client, assessment.id);
  const remaining = items.filter(
    (item) => !progress.answered.has(item.item_key),
  );
  if (isFinished(progress, remaining.length))
    return { question: null, finished: true };
  const difficulties = items.map((item) => item.difficulty);
  const target = targetDifficulty(
    progress,
    Math.min(...difficulties),
    Math.max(...difficulties),
  );
  const item = chooseItem(remaining, target);
  const question: AssessmentQuestion = {
    itemId: item.item_key,
    type: item.item_type,
    prompt: item.prompt,
    options: shuffle(item.options).map((option) => ({
      key: option.key,
      text: option.text,
    })),
  };
  return { question, finished: false };
}

export async function submitAnswer(
  client: AdminClient,
  authUserId: string,
  assessmentId: string,
  itemId: string,
  selectedOptionKey: string,
): Promise<AnswerResult> {
  const assessment = await ownedAssessment(client, authUserId, assessmentId);
  const { data, error } = await client
    .from("assessment_item")
    .select("item_key, version, difficulty, options, correct_option_key")
    .eq("language_id", assessment.language_id)
    .eq("item_key", itemId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ItemNotFound();
  const item = data as ItemRow;
  if (!item.options.some((option) => option.key === selectedOptionKey))
    throw new InvalidAnswer();
  const correct = selectedOptionKey === item.correct_option_key;
  const before = await progressOf(client, assessment.id);
  if (!before.answered.has(item.item_key)) {
    const insert = await client.from("assessment_response").insert({
      assessment_id: assessment.id,
      item_id: item.item_key,
      correct,
      difficulty_at_time: item.difficulty,
      selected_option_key: selectedOptionKey,
      item_version: item.version,
    });
    if (insert.error) throw new Error(insert.error.message);
  }
  const items = await activeItems(client, assessment.language_id);
  const progress = await progressOf(client, assessment.id);
  const remaining = items.filter(
    (candidate) => !progress.answered.has(candidate.item_key),
  ).length;
  const finished = isFinished(progress, remaining);
  if (finished) {
    await markCompleted(client, assessment.id);
    await seedKnowledgeFromAssessment(client, assessment);
  }
  return { correct, correctOptionKey: item.correct_option_key, finished };
}
