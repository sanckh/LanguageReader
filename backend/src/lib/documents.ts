import type { AdminClient } from "./supabase.js";
import type {
  DocumentContentResponse,
  DocumentMetaDto,
  DocumentMetaResponse,
  DocumentSectionDto,
} from "../interfaces/document.js";
import { getProfile } from "./profile.js";

export class DocumentNotFound extends Error {}
export class DocumentForbidden extends Error {}
export class InvalidReadingPosition extends Error {}

interface DocumentRow {
  id: string;
  is_included_library: boolean;
  owner_id: string | null;
  title: string;
  authors: string[];
  translators: string[];
  level: number | null;
  topic: string | null;
  word_count: number | null;
  attribution: string | null;
  license: string | null;
  source_notice: string | null;
}

const DOCUMENT_COLUMNS =
  "id, is_included_library, owner_id, title, authors, translators, level, topic, word_count, attribution, license, source_notice";

async function accessibleDocument(
  client: AdminClient,
  authUserId: string,
  documentId: string,
): Promise<{ doc: DocumentRow; profileId: string }> {
  const [profile, document] = await Promise.all([
    getProfile(client, authUserId),
    client
      .from("document")
      .select(DOCUMENT_COLUMNS)
      .eq("id", documentId)
      .maybeSingle(),
  ]);
  if (!profile) throw new DocumentForbidden();
  if (document.error) throw new Error(document.error.message);
  if (!document.data) throw new DocumentNotFound();
  const doc = document.data as DocumentRow;
  // Included Library is public to any learner; private docs stay owner-only.
  if (!doc.is_included_library && doc.owner_id !== profile.id)
    throw new DocumentForbidden();
  return { doc, profileId: profile.id };
}

function toMeta(doc: DocumentRow): DocumentMetaDto {
  return {
    id: doc.id,
    title: doc.title,
    authors: doc.authors ?? [],
    translators: doc.translators ?? [],
    level: doc.level,
    topic: doc.topic,
    wordCount: doc.word_count,
    attribution: doc.attribution,
    license: doc.license,
    sourceNotice: doc.source_notice,
  };
}

export async function readIncludedOpening(client: AdminClient, id: string) {
  const [document, sections] = await Promise.all([
    client
      .from("document")
      .select(DOCUMENT_COLUMNS)
      .eq("id", id)
      .eq("is_included_library", true)
      .eq("status", "ready")
      .single(),
    client
      .from("document_section")
      .select("id, position, kind, body")
      .eq("document_id", id)
      .order("position")
      .limit(6),
  ]);
  if (document.error || sections.error) throw new Error("Opening unavailable");
  return {
    document: toMeta(document.data as DocumentRow),
    sections: sections.data as DocumentSectionDto[],
  };
}

export async function readDocument(
  client: AdminClient,
  authUserId: string,
  documentId: string,
): Promise<DocumentContentResponse> {
  const { doc, profileId } = await accessibleDocument(
    client,
    authUserId,
    documentId,
  );
  const [sections, position] = await Promise.all([
    client
      .from("document_section")
      .select("id, position, kind, body")
      .eq("document_id", documentId)
      .order("position"),
    client
      .from("reading_position")
      .select("section_id, character_offset")
      .eq("user_id", profileId)
      .eq("document_id", documentId)
      .maybeSingle(),
  ]);
  if (sections.error) throw new Error(sections.error.message);
  if (position.error) throw new Error(position.error.message);
  const saved = position.data as {
    section_id: string;
    character_offset: number;
  } | null;
  return {
    document: toMeta(doc),
    sections: sections.data as DocumentSectionDto[],
    position: saved
      ? { sectionId: saved.section_id, characterOffset: saved.character_offset }
      : null,
  };
}

export async function saveReadingPosition(
  client: AdminClient,
  authUserId: string,
  documentId: string,
  sectionId: string,
  characterOffset: number,
): Promise<void> {
  const { profileId } = await accessibleDocument(
    client,
    authUserId,
    documentId,
  );
  const { error } = await client.from("reading_position").upsert(
    {
      user_id: profileId,
      document_id: documentId,
      section_id: sectionId,
      character_offset: characterOffset,
    },
    { onConflict: "user_id,document_id" },
  );
  if (error) {
    // Trigger (23514) or the section FK (23503) reject an out-of-range anchor.
    if (error.code === "23514" || error.code === "23503")
      throw new InvalidReadingPosition();
    throw new Error(error.message);
  }
}

export async function readDocumentMeta(
  client: AdminClient,
  authUserId: string,
  documentId: string,
): Promise<DocumentMetaResponse> {
  const { doc, profileId } = await accessibleDocument(
    client,
    authUserId,
    documentId,
  );
  const [count, position] = await Promise.all([
    client
      .from("document_section")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId),
    client
      .from("reading_position")
      .select("section_id, character_offset")
      .eq("user_id", profileId)
      .eq("document_id", documentId)
      .maybeSingle(),
  ]);
  if (count.error) throw new Error(count.error.message);
  if (position.error) throw new Error(position.error.message);
  const saved = position.data as {
    section_id: string;
    character_offset: number;
  } | null;
  let savedPosition = null;
  if (saved) {
    const section = await client
      .from("document_section")
      .select("position")
      .eq("document_id", documentId)
      .eq("id", saved.section_id)
      .maybeSingle();
    if (section.error) throw new Error(section.error.message);
    savedPosition = {
      sectionId: saved.section_id,
      sectionPosition:
        (section.data as { position: number } | null)?.position ?? 0,
      characterOffset: saved.character_offset,
    };
  }
  return {
    document: toMeta(doc),
    totalSections: count.count ?? 0,
    position: savedPosition,
  };
}

export async function readSections(
  client: AdminClient,
  authUserId: string,
  documentId: string,
  from: number,
  limit: number,
): Promise<DocumentSectionDto[]> {
  await accessibleDocument(client, authUserId, documentId);
  const { data, error } = await client
    .from("document_section")
    .select("id, position, kind, body")
    .eq("document_id", documentId)
    .gte("position", from)
    .lt("position", from + limit)
    .order("position");
  if (error) throw new Error(error.message);
  return data as DocumentSectionDto[];
}
