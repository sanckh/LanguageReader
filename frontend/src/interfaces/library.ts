import type { ReadingLevel } from '../models/library';

export interface LibraryBook {
  id: string;
  title: string;
  authors: string[];
  translators: string[];
  level: ReadingLevel | null;
  topic: string | null;
  word_count: number | null;
  source: string | null;
  attribution: string | null;
  license: string | null;
  source_notice: string | null;
  modification_notice: string | null;
  source_download_url: string | null;
  provider: string | null;
  kind?: string;
  epoch?: string;
}
