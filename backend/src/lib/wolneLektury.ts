import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { load } from "cheerio";
import type { AnyNode } from "domhandler";
import type {
  ImportedSection,
  LibrarySelection,
  PreparedLibraryBook,
  WolneBook,
} from "../interfaces/libraryImport.js";

const origin = "https://wolnelektury.pl";
const footerMarker =
  "Ta lektura, podobnie jak tysiące innych, dostępna jest na stronie wolnelektury.pl.";

export function providerUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== origin || url.username || url.password || url.hash)
    throw new Error("Expected an HTTPS Wolne Lektury URL");
  return url.href;
}

export function bookSlug(value: string): string {
  let slug = value;
  if (value.includes(":")) {
    const url = new URL(providerUrl(value));
    const match = /^\/(?:api\/books|katalog\/lektura)\/([a-z0-9-]+)\/?$/.exec(
      url.pathname,
    );
    if (!match) throw new Error("Expected a book URL or slug");
    slug = match[1]!;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error("Invalid book slug");
  return slug;
}

export function parseSelection(value: unknown): LibrarySelection[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new Error("Selection must contain 1–100 books");
  const result = value.map((entry: unknown) => {
    const row = typeof entry === "string" ? { book: entry } : entry;
    if (
      !row ||
      typeof row !== "object" ||
      !("book" in row) ||
      typeof row.book !== "string"
    )
      throw new Error("Each selection needs a book slug or URL");
    const level = "level" in row ? row.level : null;
    const topic = "topic" in row ? row.topic : null;
    if (level !== null && ![1, 2, 3, 4].includes(level as number))
      throw new Error("Invalid level");
    if (topic !== null && (typeof topic !== "string" || !topic.trim()))
      throw new Error("Invalid topic");
    return {
      book: bookSlug(row.book),
      level: level as LibrarySelection["level"],
      topic: topic as string | null,
    };
  });
  if (new Set(result.map((row) => row.book)).size !== result.length)
    throw new Error("Duplicate book selection");
  return result;
}

export async function fetchProviderText(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  providerUrl(url);
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: {
          Accept: "application/json, text/html, text/plain",
          "User-Agent": "LanguageReader/0.1 (curated library importer)",
        },
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    } catch {
      if (attempt === 2)
        throw new Error("Provider connection failed or timed out");
      await delay(500 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retry = Number(response.headers.get("retry-after"));
        await delay(
          Math.min(
            10000,
            Math.max(
              500 * 2 ** attempt,
              Number.isFinite(retry) ? retry * 1000 : 0,
            ),
          ),
        );
        continue;
      }
      throw new Error(`Provider returned HTTP ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty provider response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 20 * 1024 * 1024)
          throw new Error("Book exceeds the 20 MB import limit");
        chunks.push(value);
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.concat(chunks),
      );
    } finally {
      await reader.cancel();
    }
  }
  throw new Error("Provider unavailable");
}

export function parseBook(value: unknown): WolneBook {
  if (!value || typeof value !== "object")
    throw new Error("Invalid book response");
  const row = value as Record<string, unknown>;
  for (const field of ["title", "url", "html", "txt", "epub", "language"])
    if (typeof row[field] !== "string" || !row[field])
      throw new Error(`Book is missing ${field}`);
  if (row.language !== "pol")
    throw new Error("Only Polish editions are supported");
  if (row.preview === true)
    throw new Error("Preview-only editions are not supported");
  for (const field of ["url", "html", "txt", "epub"])
    providerUrl(row[field] as string);
  for (const field of ["authors", "translators"]) {
    if (
      !Array.isArray(row[field]) ||
      !(row[field] as unknown[]).every(
        (person) =>
          person !== null &&
          typeof person === "object" &&
          "name" in person &&
          typeof person.name === "string" &&
          person.name.trim(),
      )
    )
      throw new Error(`Invalid ${field}`);
  }
  return row as unknown as WolneBook;
}

export function parseBookSections(html: string): ImportedSection[] {
  const $ = load(html);
  const root = $("#book-text");
  if (root.length !== 1) throw new Error("Missing book-text container");
  root.find("#toc, #themes, #nota_red").remove();
  root.find("a.annotation").each((_, element) => {
    const anchor = $(element);
    anchor.replaceWith(anchor.text().trim());
  });
  root.find("a.theme-begin, a.theme-end, a.anchor, a.note-ref").remove();
  const sections: ImportedSection[] = [];
  const blocks = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"]);
  const containers = new Set(["div", "blockquote", "ol", "ul", "section"]);
  const inline = new Set([
    "a",
    "span",
    "em",
    "strong",
    "b",
    "i",
    "u",
    "sup",
    "sub",
    "small",
    "br",
  ]);
  const textOf = (node: AnyNode): string => {
    if (node.type === "text") return node.data;
    if (node.type === "comment") return "";
    if (
      !("tagName" in node) ||
      (!inline.has(node.tagName) &&
        !blocks.has(node.tagName) &&
        !containers.has(node.tagName))
    )
      throw new Error(
        `Unsupported book element: ${"tagName" in node ? node.tagName : node.type}`,
      );
    if (node.tagName === "br") return "\n";
    const text = node.children.map(textOf).join("");
    return $(node).is("h1 > span") ? `${text}\n` : text;
  };
  const clean = (text: string) =>
    text
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
  const visit = (node: AnyNode): void => {
    if (node.type === "comment") return;
    if (node.type === "text") {
      if (node.data.trim())
        throw new Error("Unsupported text outside a book paragraph");
      return;
    }
    if (!("tagName" in node)) throw new Error("Unsupported book node");
    const el = $(node);
    if (
      blocks.has(node.tagName) ||
      el.hasClass("verse") ||
      el.hasClass("didaskalia") ||
      el.is('[class^="fn-"]')
    ) {
      const body = clean(textOf(node));
      if (body)
        sections.push({
          kind: /^h[1-6]$/.test(node.tagName) ? "heading" : "paragraph",
          body,
        });
    } else if (containers.has(node.tagName)) {
      node.children.forEach(visit);
    } else if (node.tagName === "hr") {
      sections.push({ kind: "paragraph", body: "⁂" });
    } else if (node.tagName === "a" && !el.text().trim()) {
      return;
    } else {
      throw new Error(`Unsupported book structure: ${node.tagName}`);
    }
  };
  root.contents().each((_, node) => visit(node));
  if (!sections.length || sections.length > 50000)
    throw new Error("Invalid book section count");
  return sections;
}

export function prepareBook(
  selection: LibrarySelection,
  details: WolneBook,
  html: string,
  txt: string,
): PreparedLibraryBook {
  const start = txt.lastIndexOf(footerMarker);
  if (start < 0)
    throw new Error(
      "Missing provider attribution footer; review this edition manually",
    );
  const notice = txt.slice(start).trim();
  const licenses = notice
    .split(/\r?\n/)
    .filter((line) => /domenie publicznej|licencj/i.test(line));
  if (!licenses.length) throw new Error("Missing license notice");
  const sections = parseBookSections(html);
  const authors = details.authors.map((person) => person.name);
  const translators = details.translators.map((person) => person.name);
  return {
    book: {
      slug: bookSlug(selection.book),
      title: details.title,
      source: details.url,
      source_download_url: details.epub,
      authors,
      translators,
      level: selection.level,
      topic: selection.topic,
      word_count: sections.reduce(
        (count, section) =>
          count +
          (section.body.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)
            ?.length ?? 0),
        0,
      ),
      attribution: [
        details.title,
        authors.join(", "),
        translators.length ? `Translation: ${translators.join(", ")}` : "",
        "Książka pochodzi z serwisu Wolne Lektury",
        details.url,
      ]
        .filter(Boolean)
        .join("\n"),
      license: licenses.join("\n"),
      source_notice: notice,
      modification_notice:
        "Converted from the Wolne Lektury HTML edition to plain-text sections. Inline styling and theme navigation removed; verse lines and footnotes retained. Editorial change notes remain available in the original edition.",
      content_hash: createHash("sha256")
        .update(JSON.stringify(sections))
        .digest("hex"),
    },
    sections,
  };
}

export async function fetchBook(
  selection: LibrarySelection,
  fetcher: typeof fetch = fetch,
): Promise<PreparedLibraryBook> {
  const slug = bookSlug(selection.book);
  const details = parseBook(
    JSON.parse(
      await fetchProviderText(
        `${origin}/api/books/${slug}/?format=json`,
        fetcher,
      ),
    ) as unknown,
  );
  const [html, txt] = await Promise.all([
    fetchProviderText(details.html, fetcher),
    fetchProviderText(details.txt, fetcher),
  ]);
  return prepareBook(selection, details, html, txt);
}
