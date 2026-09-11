import type { ProviderCatalogBook } from "../interfaces/providerCatalog.js";

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
