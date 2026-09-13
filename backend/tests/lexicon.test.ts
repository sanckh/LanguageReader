import test from "node:test";
import assert from "node:assert/strict";
import { assembleSenses, normalizeAnalyses } from "../src/lib/lexicon.js";

test("attaches each lexeme's part of speech to its meanings", () => {
  const senses = assembleSenses(
    [
      { id: "n1", part_of_speech: "noun" },
      { id: "v1", part_of_speech: "verb" },
    ],
    [
      { lexeme_id: "n1", gloss: "lock (on a door)", source: "omw" },
      { lexeme_id: "v1", gloss: "to close", source: "omw" },
    ],
  );
  assert.equal(senses.length, 2);
  const noun = senses.find((s) => s.lexemeId === "n1");
  assert.equal(noun?.partOfSpeech, "noun");
  assert.equal(noun?.gloss, "lock (on a door)");
});

test("keeps homonyms as separate candidate senses", () => {
  // "zamek" — castle vs. lock vs. zipper: several senses for one spelling.
  const senses = assembleSenses(
    [{ id: "x", part_of_speech: "noun" }],
    [
      { lexeme_id: "x", gloss: "castle", source: "omw" },
      { lexeme_id: "x", gloss: "lock", source: "omw" },
      { lexeme_id: "x", gloss: "zipper", source: "omw" },
    ],
  );
  assert.deepEqual(
    senses.map((s) => s.gloss),
    ["castle", "lock", "zipper"],
  );
});

test("drops duplicate glosses within the same lexeme", () => {
  const senses = assembleSenses(
    [{ id: "x", part_of_speech: "noun" }],
    [
      { lexeme_id: "x", gloss: "word", source: "omw" },
      { lexeme_id: "x", gloss: "word", source: "omw" },
    ],
  );
  assert.equal(senses.length, 1);
});

test("ignores meanings whose lexeme is not in the result set", () => {
  const senses = assembleSenses(
    [{ id: "keep", part_of_speech: null }],
    [
      { lexeme_id: "keep", gloss: "kept", source: null },
      { lexeme_id: "orphan", gloss: "dropped", source: null },
    ],
  );
  assert.deepEqual(
    senses.map((s) => s.gloss),
    ["kept"],
  );
});

test("orders senses by part of speech then gloss for a stable response", () => {
  const senses = assembleSenses(
    [
      { id: "v", part_of_speech: "verb" },
      { id: "n", part_of_speech: "noun" },
    ],
    [
      { lexeme_id: "v", gloss: "to run", source: null },
      { lexeme_id: "n", gloss: "zebra", source: null },
      { lexeme_id: "n", gloss: "apple", source: null },
    ],
  );
  assert.deepEqual(
    senses.map((s) => `${s.partOfSpeech}:${s.gloss}`),
    ["noun:apple", "noun:zebra", "verb:to run"],
  );
});

test("normalizeAnalyses returns lemma, POS and features per reading", () => {
  const analyses = normalizeAnalyses([
    {
      grammatical_features: { number: "sg", case: "inst", gender: "m2" },
      lexeme: { id: "l1", lemma: "kot", part_of_speech: "noun" },
    },
  ]);
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0]!.lemma, "kot");
  assert.equal(analyses[0]!.partOfSpeech, "noun");
  assert.deepEqual(analyses[0]!.features, {
    number: "sg",
    case: "inst",
    gender: "m2",
  });
});

test("normalizeAnalyses keeps distinct readings of an ambiguous form", () => {
  // "ma" — verb "mieć" vs. possessive adjective "mój".
  const analyses = normalizeAnalyses([
    {
      grammatical_features: { number: "sg", person: "ter", aspect: "imperf" },
      lexeme: { id: "v", lemma: "mieć", part_of_speech: "verb" },
    },
    {
      grammatical_features: { number: "sg", case: "nom", gender: "f" },
      lexeme: { id: "a", lemma: "mój", part_of_speech: "adjective" },
    },
  ]);
  assert.deepEqual(
    analyses.map((a) => `${a.partOfSpeech}:${a.lemma}`),
    ["adjective:mój", "verb:mieć"],
  );
});

test("normalizeAnalyses dedupes identical readings and drops rows without a lexeme", () => {
  const analyses = normalizeAnalyses([
    {
      grammatical_features: { number: "pl", case: "gen" },
      lexeme: { id: "x", lemma: "dom", part_of_speech: "noun" },
    },
    {
      grammatical_features: { number: "pl", case: "gen" },
      lexeme: { id: "x", lemma: "dom", part_of_speech: "noun" },
    },
    { grammatical_features: null, lexeme: null },
  ]);
  assert.equal(analyses.length, 1);
  assert.deepEqual(analyses[0]!.features, { number: "pl", case: "gen" });
});

test("normalizeAnalyses treats missing features as an empty bag", () => {
  const analyses = normalizeAnalyses([
    {
      grammatical_features: null,
      lexeme: { id: "p", lemma: ".", part_of_speech: null },
    },
  ]);
  assert.deepEqual(analyses[0]!.features, {});
  assert.equal(analyses[0]!.partOfSpeech, null);
});
