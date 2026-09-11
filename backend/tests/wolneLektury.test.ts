import assert from "node:assert/strict";
import test from "node:test";
import {
  bookSlug,
  fetchProviderText,
  parseBook,
  parseBookSections,
  parseSelection,
  prepareBook,
} from "../src/lib/wolneLektury.js";

const details = {
  title: "Test",
  url: "https://wolnelektury.pl/katalog/lektura/test/",
  language: "pol",
  html: "https://wolnelektury.pl/media/book/html/test.html",
  txt: "https://wolnelektury.pl/media/book/txt/test.txt",
  epub: "https://wolnelektury.pl/media/book/epub/test.epub",
  authors: [{ name: "Author" }],
  translators: [{ name: "Translator" }],
};
const html = `<div id="book-text"><div id="toc"><h2>Navigation</h2></div><div id="themes">Themes</div>
 <h1><span class="author">Author</span><span class="title">Test</span></h1>
 <a class="anchor">1</a><p>Zażółć <em>gęślą</em> jaźń<a class="annotation">[1]</a>.</p>
 <h2>Akt I</h2><div class="kwestia"><h3>ANNA</h3><div class="didaskalia">Cicho.</div>
 <div class="stanza"><div class="verse">Pierwszy wers</div><div class="verse">Drugi wers</div></div></div>
 <div id="footnotes"><h3>Przypisy</h3><div class="fn-pe"><a class="annotation">[1]</a><p>Objaśnienie.</p></div></div></div>`;
const notice =
  "Ta lektura, podobnie jak tysiące innych, dostępna jest na stronie wolnelektury.pl.\nTen utwór jest w domenie publicznej.\nPrzypisy: Licencja Wolnej Sztuki 1.3.\nEditor credits.";

test("book structure retains Polish, separate headings, drama, verse and numbered notes", () => {
  const sections = parseBookSections(html);
  assert.deepEqual(
    sections.map((s) => s.body),
    [
      "Author\nTest",
      "Zażółć gęślą jaźń[1].",
      "Akt I",
      "ANNA",
      "Cicho.",
      "Pierwszy wers",
      "Drugi wers",
      "Przypisy",
      "[1]Objaśnienie.",
    ],
  );
  assert.equal(sections[2]?.kind, "heading");
  assert.throws(
    () =>
      parseBookSections(
        '<div id="book-text"><table><tr><td>Not supported</td></tr></table></div>',
      ),
    /Unsupported/,
  );
  assert.throws(
    () => parseBookSections("<p>No book container</p>"),
    /container/,
  );
  assert.throws(
    () => parseBookSections('<div id="book-text"><p><img src="x"></p></div>'),
    /Unsupported/,
  );
});

test("selection and provider metadata reject unsupported or unsafe inputs", () => {
  assert.equal(bookSlug(details.url), "test");
  assert.equal(
    bookSlug("https://wolnelektury.pl/api/books/test/?format=json"),
    "test",
  );
  assert.throws(() => bookSlug("https://evil.test/test/"));
  assert.throws(() => bookSlug("../test"));
  assert.throws(() => parseSelection(["test", "test"]), /Duplicate/);
  assert.throws(() => parseSelection([{ book: "test", level: 5 }]), /level/);
  assert.equal(parseSelection(["test"])[0]?.level, null);
  assert.throws(() => parseBook({ ...details, language: "eng" }), /Polish/);
  assert.throws(() => parseBook({ ...details, preview: true }), /Preview/);
  assert.throws(() =>
    parseBook({ ...details, html: "http://127.0.0.1/private" }),
  );
  assert.throws(() => parseBook({ ...details, authors: [null] }), /authors/);
});

test("edition credits and license footer are retained and content hashes are stable", () => {
  const selection = parseSelection(["test"])[0]!;
  const result = prepareBook(selection, parseBook(details), html, notice);
  assert.equal(result.book.source_notice, notice);
  assert.match(result.book.attribution, /Translator/);
  assert.match(result.book.license, /Licencja Wolnej Sztuki/);
  assert.equal(result.book.level, null);
  assert.ok(result.book.word_count > 0);
  assert.equal(
    result.book.content_hash,
    prepareBook(selection, details, html, notice).book.content_hash,
  );
  assert.throws(
    () => prepareBook(selection, details, html, "No footer"),
    /attribution/,
  );
});

test("provider requests are credential-free, bounded and do not retry missing books", async () => {
  let attempts = 0;
  const fetcher = (async (_url, init) => {
    attempts++;
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  await assert.rejects(fetchProviderText(details.url, fetcher), /404/);
  assert.equal(attempts, 1);
  const retry = (async () => {
    attempts++;
    return attempts === 2
      ? new Response("", { status: 429 })
      : new Response("ok");
  }) as typeof fetch;
  assert.equal(await fetchProviderText(details.url, retry), "ok");
  assert.equal(attempts, 3);
});
