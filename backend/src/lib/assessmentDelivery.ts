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
const CHECK_MAX_QUESTIONS = 8;

interface AssessmentRow {
  id: string;
  user_id: string;
  language_id: string;
  kind: "onboarding" | "knowledge_check";
  focus_difficulty: number | null;
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

function scopedItems(assessment: AssessmentRow, items: ItemRow[]): ItemRow[] {
  if (
    assessment.kind === "knowledge_check" &&
    assessment.focus_difficulty !== null
  )
    return items.filter(
      (item) => item.difficulty === assessment.focus_difficulty,
    );
  return items;
}

// Onboarding walks a difficulty ladder (correct raises the target, wrong lowers
// it); order-independent so it recomputes from stored responses.
function targetDifficulty(
  progress: Progress,
  min: number,
  max: number,
): number {
  const raw =
    START_DIFFICULTY + progress.correct - (progress.count - progress.correct);
  return Math.max(min, Math.min(max, raw));
}

function isFinished(
  assessment: AssessmentRow,
  progress: Progress,
  remaining: number,
  scopeCount: number,
): boolean {
  if (remaining === 0) return true;
  if (assessment.kind === "knowledge_check")
    return progress.count >= Math.min(scopeCount, CHECK_MAX_QUESTIONS);
  if (progress.count >= MAX_QUESTIONS) return true;
  if (progress.count >= MIN_FOR_EARLY_STOP) {
    const accuracy = progress.correct / progress.count;
    if (accuracy >= HIGH_ACCURACY || accuracy <= LOW_ACCURACY) return true;
  }
  return false;
}

function chooseItem(
  assessment: AssessmentRow,
  remaining: ItemRow[],
  scopeItems: ItemRow[],
  progress: Progress,
): ItemRow {
  if (assessment.kind === "knowledge_check")
    return [...remaining].sort((a, b) =>
      a.item_key < b.item_key ? -1 : a.item_key > b.item_key ? 1 : 0,
    )[0]!;
  const difficulties = scopeItems.map((item) => item.difficulty);
  const target = targetDifficulty(
    progress,
    Math.min(...difficulties),
    Math.max(...difficulties),
  );
  return remaining.reduce((best, item) => {
    const distance = Math.abs(item.difficulty - target);
    const bestDistance = Math.abs(best.difficulty - target);
    if (distance < bestDistance) return item;
    if (distance === bestDistance && item.item_key < best.item_key) return item;
    return best;
  });
}

async function ownedAssessment(
  client: AdminClient,
  authUserId: string,
  assessmentId: string,
): Promise<AssessmentRow> {
  const [profile, assessment] = await Promise.all([
    getProfile(client, authUserId),
    client
      .from("assessment")
      .select("id, user_id, language_id, kind, focus_difficulty")
      .eq("id", assessmentId)
      .maybeSingle(),
  ]);
  if (assessment.error) throw new Error(assessment.error.message);
  if (!profile) throw new AssessmentForbidden();
  if (!assessment.data) throw new AssessmentNotFound();
  const row = assessment.data as AssessmentRow;
  if (row.user_id !== profile.id) throw new AssessmentForbidden();
  return row;
}

async function fetchItem(
  client: AdminClient,
  languageId: string,
  itemKey: string,
): Promise<ItemRow | null> {
  const { data, error } = await client
    .from("assessment_item")
    .select(
      "item_key, version, item_type, difficulty, prompt, options, correct_option_key",
    )
    .eq("language_id", languageId)
    .eq("item_key", itemKey)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ItemRow | null) ?? null;
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

// Completes the assessment and seeds the learner model exactly once, whichever
// request (answer or next) first observes that it is finished.
async function finalize(
  client: AdminClient,
  assessment: AssessmentRow,
): Promise<void> {
  const { data, error } = await client
    .from("assessment")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", assessment.id)
    .eq("status", "in_progress")
    .select("id");
  if (error) throw new Error(error.message);
  if ((data as { id: string }[]).length > 0)
    await seedKnowledgeFromAssessment(client, assessment);
}

export async function nextQuestion(
  client: AdminClient,
  authUserId: string,
  assessmentId: string,
): Promise<NextQuestion> {
  const assessment = await ownedAssessment(client, authUserId, assessmentId);
  const [allItems, progress] = await Promise.all([
    activeItems(client, assessment.language_id),
    progressOf(client, assessment.id),
  ]);
  const items = scopedItems(assessment, allItems);
  const remaining = items.filter(
    (item) => !progress.answered.has(item.item_key),
  );
  if (isFinished(assessment, progress, remaining.length, items.length)) {
    await finalize(client, assessment);
    return { question: null, finished: true };
  }
  const item = chooseItem(assessment, remaining, items, progress);
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
  const [item, allItems, before] = await Promise.all([
    fetchItem(client, assessment.language_id, itemId),
    activeItems(client, assessment.language_id),
    progressOf(client, assessment.id),
  ]);
  if (!item) throw new ItemNotFound();
  if (
    assessment.kind === "knowledge_check" &&
    assessment.focus_difficulty !== null &&
    item.difficulty !== assessment.focus_difficulty
  )
    throw new ItemNotFound();
  if (!item.options.some((option) => option.key === selectedOptionKey))
    throw new InvalidAnswer();
  const correct = selectedOptionKey === item.correct_option_key;
  const alreadyAnswered = before.answered.has(item.item_key);
  if (!alreadyAnswered) {
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
  // Derive post-insert progress in memory instead of re-reading it.
  const answered = new Set(before.answered);
  answered.add(item.item_key);
  const progress: Progress = alreadyAnswered
    ? before
    : {
        answered,
        count: before.count + 1,
        correct: before.correct + (correct ? 1 : 0),
      };
  const items = scopedItems(assessment, allItems);
  const remaining = items.filter(
    (candidate) => !answered.has(candidate.item_key),
  ).length;
  const finished = isFinished(assessment, progress, remaining, items.length);
  if (finished) await finalize(client, assessment);
  return { correct, correctOptionKey: item.correct_option_key, finished };
}
