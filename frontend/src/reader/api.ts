import { apiFetch } from '../lib/api';
import type {
  DocumentMetaResponse,
  SectionsResponse,
} from '../interfaces/document';

export function getDocumentMeta(id: string): Promise<DocumentMetaResponse> {
  return apiFetch<DocumentMetaResponse>(`/api/documents/${id}/meta`);
}

export function getSections(
  id: string,
  from: number,
  limit: number,
): Promise<SectionsResponse> {
  return apiFetch<SectionsResponse>(
    `/api/documents/${id}/sections?from=${from}&limit=${limit}`,
  );
}

export function saveReadingPosition(
  id: string,
  sectionId: string,
  characterOffset: number,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/documents/${id}/position`, {
    method: 'PUT',
    body: JSON.stringify({ sectionId, characterOffset }),
  });
}
