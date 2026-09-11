import type { ProviderCatalogBook } from "../interfaces/providerCatalog.js";
import { fetchProviderText } from "./wolneLektury.js";

export function createCatalogCache(
  load: () => Promise<ProviderCatalogBook[]>,
  ttl = 15 * 60_000,
) {
  let cached: ProviderCatalogBook[] | undefined;
  let expires = 0;
  let pending: Promise<ProviderCatalogBook[]> | undefined;
  return () => {
    if (cached && Date.now() < expires) return Promise.resolve(cached);
    pending ??= load()
      .then((books) => {
        cached = books;
        expires = Date.now() + ttl;
        return books;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}

export const getProviderCatalog = createCatalogCache(async () =>
  parseCatalog(
    JSON.parse(
      await fetchProviderText("https://wolnelektury.pl/api/books/?format=json"),
    ),
  ),
);

export function parseCatalog(value: unknown): ProviderCatalogBook[] {
  if (!Array.isArray(value)) throw new Error("Invalid provider catalog");
  return value.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const text = (key: string) =>
      typeof record[key] === "string" ? record[key] : "";
    if (!text("title") || !text("href")) return [];
    return [
      {
        title: text("title"),
        href: text("href"),
        url: text("url"),
        author: text("author"),
        genre: text("genre"),
        kind: text("kind"),
        epoch: text("epoch"),
      },
    ];
  });
}

export function searchCatalog(books: ProviderCatalogBook[], query: string) {
  const search = query.trim().toLocaleLowerCase("pl");
  return books.filter((book) =>
    [book.title, book.author, book.genre, book.kind, book.epoch]
      .join(" ")
      .toLocaleLowerCase("pl")
      .includes(search),
  );
}
