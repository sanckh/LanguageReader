import { apiFetch } from '../lib/api';
import type { LemmaMeaningsDto, TokenLookupDto } from '../interfaces/language';

// Word-lookup client. Kept language-agnostic (code is a parameter) so the same
// calls serve any language the backend supports.

export function analyzeToken(
  code: string,
  token: string,
): Promise<TokenLookupDto> {
  return apiFetch<TokenLookupDto>(
    `/api/language/${code}/analyze?token=${encodeURIComponent(token)}`,
  );
}

export function lookupMeanings(
  code: string,
  lemma: string,
  pos?: string,
): Promise<LemmaMeaningsDto> {
  const params = new URLSearchParams({ lemma });
  if (pos) params.set('pos', pos);
  return apiFetch<LemmaMeaningsDto>(
    `/api/language/${code}/meanings?${params.toString()}`,
  );
}
