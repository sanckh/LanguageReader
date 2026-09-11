import assert from "node:assert/strict";
import test from "node:test";
import {
  createCatalogCache,
  parseCatalog,
  searchCatalog,
} from "../src/lib/providerCatalog.js";

test("catalog cache shares concurrent requests and retries failures", async () => {
  let calls = 0;
  const cache = createCatalogCache(async () => {
    calls++;
    return [];
  });
  await Promise.all([cache(), cache(), cache()]);
  await cache();
  assert.equal(calls, 1);
  let failures = 0;
  const retry = createCatalogCache(async () => {
    if (failures++ === 0) throw new Error("offline");
    return [];
  });
  await assert.rejects(retry());
  assert.deepEqual(await retry(), []);
  const expired = createCatalogCache(async () => {
    calls++;
    return [];
  }, -1);
  await expired();
  await expired();
  assert.equal(calls, 3);
});

test("catalog preserves metadata and searches beyond the first page", () => {
  const books = parseCatalog([
    ...Array.from({ length: 45 }, (_, i) => ({
      title: `Book ${i}`,
      href: `https://example.com/${i}`,
    })),
    {
      title: "Studnia",
      href: "https://example.com/studnia",
      author: "Edgar Allan Poe",
      genre: "opowiadanie",
      kind: "Epika",
      epoch: "Romantyzm",
      url: "https://example.com/read",
    },
    null,
    { title: 42 },
  ]);
  assert.equal(books.length, 46);
  for (const query of [
    " POE ",
    "opowiadanie",
    "romantyzm",
    "epika",
    "studnia",
  ]) {
    assert.equal(searchCatalog(books, query)[0]?.author, "Edgar Allan Poe");
  }
  assert.equal(searchCatalog(books, "missing").length, 0);
  assert.throws(() => parseCatalog({ error: "unavailable" }));
});
