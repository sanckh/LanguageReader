import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog, searchCatalog } from "../src/lib/providerCatalog.js";

test("catalog preserves metadata and searches beyond the first page", () => {
  const books = parseCatalog([
    ...Array.from({ length: 45 }, (_, i) => ({ title: `Book ${i}`, href: `https://example.com/${i}` })),
    { title: "Studnia", href: "https://example.com/studnia", author: "Edgar Allan Poe", genre: "opowiadanie", kind: "Epika", epoch: "Romantyzm", url: "https://example.com/read" },
    null, { title: 42 },
  ]);
  assert.equal(books.length, 46);
  for (const query of [" POE ", "opowiadanie", "romantyzm", "epika", "studnia"]) {
    assert.equal(searchCatalog(books, query)[0]?.author, "Edgar Allan Poe");
  }
  assert.equal(searchCatalog(books, "missing").length, 0);
  assert.throws(() => parseCatalog({ error: "unavailable" }));
});
