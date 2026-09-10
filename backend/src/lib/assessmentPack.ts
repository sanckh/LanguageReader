import { createHash } from "node:crypto";
import type {
  AssessmentOption,
  AssessmentPack,
  NormalizedItem,
  PackItem,
} from "../interfaces/assessmentPack.js";

function fail(message: string): never {
  throw new Error("Invalid assessment pack: " + message);
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hash8(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 8);
}

function parseItem(raw: unknown, index: number): PackItem {
  if (typeof raw !== "object" || raw === null)
    fail(`item ${index} is not an object`);
  const item = raw as Record<string, unknown>;
  const type = item.type;
  if (
    type !== "vocabulary_meaning" &&
    type !== "sentence_comprehension" &&
    type !== "grammar_form"
  )
    fail(`item ${index} has an invalid type`);
  if (
    typeof item.difficulty !== "number" ||
    !Number.isInteger(item.difficulty) ||
    item.difficulty < 1 ||
    item.difficulty > 5
  )
    fail(`item ${index} difficulty must be an integer 1-5`);
  if (typeof item.correct !== "string" || !item.correct.trim())
    fail(`item ${index} is missing a correct answer`);
  if (!Array.isArray(item.distractors) || item.distractors.length < 1)
    fail(`item ${index} needs at least one distractor`);
  for (const distractor of item.distractors)
    if (typeof distractor !== "string" || !distractor.trim())
      fail(`item ${index} has an empty distractor`);
  const answers = [item.correct, ...(item.distractors as string[])];
  if (
    new Set(answers.map((a) => a.trim().toLowerCase())).size !== answers.length
  )
    fail(`item ${index} has duplicate or ambiguous options`);
  if (
    type === "vocabulary_meaning" &&
    (typeof item.lemma !== "string" || !item.lemma.trim())
  )
    fail(`vocabulary item ${index} needs a lemma`);
  if (
    (type === "sentence_comprehension" || type === "grammar_form") &&
    (typeof item.prompt !== "string" || !item.prompt.trim())
  )
    fail(`${type} item ${index} needs a prompt`);
  const result: PackItem = {
    type,
    difficulty: item.difficulty,
    correct: item.correct,
    distractors: item.distractors as string[],
  };
  if (typeof item.lemma === "string") result.lemma = item.lemma;
  if (typeof item.prompt === "string") result.prompt = item.prompt;
  if (Array.isArray(item.concepts))
    result.concepts = item.concepts.filter(
      (c): c is string => typeof c === "string",
    );
  if (typeof item.frequencyBand === "number")
    result.frequencyBand = item.frequencyBand;
  return result;
}

export function parsePack(raw: unknown): AssessmentPack {
  if (typeof raw !== "object" || raw === null) fail("not an object");
  const pack = raw as Record<string, unknown>;
  if (typeof pack.language !== "string" || !pack.language)
    fail("missing language");
  if (typeof pack.baseLanguage !== "string" || !pack.baseLanguage)
    fail("missing baseLanguage");
  if (
    typeof pack.version !== "number" ||
    !Number.isInteger(pack.version) ||
    pack.version < 1
  )
    fail("version must be a positive integer");
  if (!Array.isArray(pack.items) || pack.items.length === 0)
    fail("items must be a non-empty array");
  return {
    language: pack.language,
    baseLanguage: pack.baseLanguage,
    version: pack.version,
    items: pack.items.map(parseItem),
  };
}

// Deterministic key assignment: correct is not always "a", but is stable per
// item across re-runs, so imports stay idempotent while delivery can shuffle.
function stableOptions(
  itemKey: string,
  correct: string,
  distractors: string[],
): { options: AssessmentOption[]; correctOptionKey: string } {
  const ordered = [correct, ...distractors]
    .map((text) => ({ text, sort: hash8(itemKey + "|" + text) }))
    .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
  const options = ordered.map((entry, i) => ({
    key: String.fromCharCode(97 + i),
    text: entry.text,
  }));
  const correctOption = options.find((option) => option.text === correct);
  if (!correctOption) fail("correct answer is not among the options");
  return { options, correctOptionKey: correctOption.key };
}

export function normalizePack(pack: AssessmentPack): NormalizedItem[] {
  const seen = new Set<string>();
  return pack.items.map((item) => {
    const isVocab = item.type === "vocabulary_meaning";
    const prompt = isVocab ? (item.lemma as string) : (item.prompt as string);
    const prefix = item.type === "grammar_form" ? "g" : "s";
    const itemKey = isVocab
      ? `${pack.language}.v${pack.version}.${slug(item.lemma as string)}.${slug(item.correct)}`
      : `${pack.language}.v${pack.version}.${prefix}.${hash8(prompt)}`;
    if (seen.has(itemKey)) fail(`duplicate item key ${itemKey}`);
    seen.add(itemKey);
    const { options, correctOptionKey } = stableOptions(
      itemKey,
      item.correct,
      item.distractors,
    );
    const metadata: Record<string, unknown> = {};
    if (item.concepts) metadata.concepts = item.concepts;
    if (item.frequencyBand !== undefined)
      metadata.frequencyBand = item.frequencyBand;
    return {
      itemKey,
      version: pack.version,
      itemType: item.type,
      difficulty: item.difficulty,
      targetLemma: isVocab ? (item.lemma as string) : null,
      prompt,
      options,
      correctOptionKey,
      correctText: item.correct,
      metadata,
    };
  });
}
