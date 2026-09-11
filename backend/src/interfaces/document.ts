import type { SectionKind } from "../models/document.js";

export interface DocumentSectionDto {
  id: string;
  position: number;
  kind: SectionKind;
  body: string;
}

export interface DocumentMetaDto {
  id: string;
  title: string;
  authors: string[];
  translators: string[];
  level: number | null;
  topic: string | null;
  wordCount: number | null;
  attribution: string | null;
  license: string | null;
  sourceNotice: string | null;
}

export interface ReadingPositionDto {
  sectionId: string;
  characterOffset: number;
}

export interface DocumentContentResponse {
  document: DocumentMetaDto;
  sections: DocumentSectionDto[];
  position: ReadingPositionDto | null;
}

export interface SavedPosition {
  sectionId: string;
  sectionPosition: number;
  characterOffset: number;
}

export interface DocumentMetaResponse {
  document: DocumentMetaDto;
  totalSections: number;
  position: SavedPosition | null;
}

export interface SectionsResponse {
  sections: DocumentSectionDto[];
}
