export interface LibrarySelection {
  book: string;
  level: 1 | 2 | 3 | 4 | null;
  topic: string | null;
}

export interface ImportedSection {
  kind: "heading" | "paragraph";
  body: string;
}

export interface WolneBook {
  title: string;
  url: string;
  language: string;
  html: string;
  txt: string;
  epub: string;
  authors: { name: string }[];
  translators: { name: string }[];
}

export interface LibraryImportBook {
  slug: string;
  title: string;
  source: string;
  source_download_url: string;
  authors: string[];
  translators: string[];
  level: LibrarySelection["level"];
  topic: string | null;
  word_count: number;
  attribution: string;
  license: string;
  source_notice: string;
  modification_notice: string;
  content_hash: string;
}

export interface PreparedLibraryBook {
  book: LibraryImportBook;
  sections: ImportedSection[];
}
