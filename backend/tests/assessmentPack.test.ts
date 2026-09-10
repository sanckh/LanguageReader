import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePack, parsePack } from "../src/lib/assessmentPack.js";

const pack = {
  language: "pl",
  baseLanguage: "en",
  version: 1,
  items: [
    {
      type: "vocabulary_meaning",
      lemma: "dom",
      difficulty: 1,
      correct: "house",
      distractors: ["dog", "food", "work"],
      concepts: ["common_noun"],
      frequencyBand: 1,
    },
    {
      type: "sentence_comprehension",
      prompt: "To jest mój dom.",
      difficulty: 2,
      correct: "This is my house.",
      distractors: ["This is my dog.", "Where is my house?"],
    },
  ],
};

test("normalizes items into stable, keyed options", () => {
  const items = normalizePack(parsePack(pack));
  assert.equal(items.length, 2);
  const [vocab, sentence] = items;
  assert.equal(vocab!.itemKey, "pl.v1.dom.house");
  assert.equal(vocab!.targetLemma, "dom");
  assert.equal(vocab!.prompt, "dom");
  assert.equal(vocab!.options.length, 4);
  const correct = vocab!.options.find((o) => o.key === vocab!.correctOptionKey);
  assert.equal(correct!.text, "house");
  assert.equal(vocab!.correctText, "house");
  assert.deepEqual(vocab!.metadata, {
    concepts: ["common_noun"],
    frequencyBand: 1,
  });
  assert.ok(sentence!.itemKey.startsWith("pl.v1.s."));
  assert.equal(sentence!.targetLemma, null);
  assert.equal(sentence!.options.length, 3);
});

test("option keys and ordering are deterministic across runs", () => {
  const first = normalizePack(parsePack(pack));
  const second = normalizePack(parsePack(pack));
  assert.deepEqual(first, second);
});

test("rejects invalid packs", () => {
  assert.throws(() => parsePack({ language: "pl" }));
  assert.throws(() =>
    parsePack({ ...pack, items: [{ ...pack.items[0], difficulty: 9 }] }),
  );
  assert.throws(() =>
    parsePack({
      ...pack,
      items: [
        {
          type: "vocabulary_meaning",
          difficulty: 1,
          correct: "x",
          distractors: ["y"],
        },
      ],
    }),
  );
  assert.throws(() =>
    parsePack({
      ...pack,
      items: [
        {
          type: "vocabulary_meaning",
          lemma: "kot",
          difficulty: 1,
          correct: "cat",
          distractors: ["cat", "dog"],
        },
      ],
    }),
  );
});

test("rejects duplicate item keys", () => {
  assert.throws(() =>
    normalizePack(
      parsePack({ ...pack, items: [pack.items[0], pack.items[0]] }),
    ),
  );
});

test("the committed Polish pack parses and normalizes cleanly", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../language-data/pl/assessment.v1.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
  const parsed = parsePack(raw);
  assert.equal(parsed.language, "pl");
  assert.equal(parsed.baseLanguage, "en");
  const items = normalizePack(parsed);
  assert.ok(items.length >= 40);
  assert.equal(new Set(items.map((i) => i.itemKey)).size, items.length);
  for (const item of items) {
    assert.ok(item.options.length >= 2);
    assert.ok(
      item.options.some((o) => o.key === item.correctOptionKey),
      item.itemKey,
    );
  }
});
