export interface LanguageDto {
  code: string;
  name: string;
}

export interface LanguageOptions {
  native: LanguageDto[];
  learning: LanguageDto[];
}

export interface LanguageSelection {
  native: LanguageDto | null;
  learning: LanguageDto | null;
}

export interface LanguageOnboarding {
  options: LanguageOptions;
  selection: LanguageSelection;
}

// Word-lookup contract shapes (mirror backend/src/interfaces/language.ts).
export interface WordSenseDto {
  lexemeId: string;
  partOfSpeech: string | null;
  gloss: string;
  source: string | null;
}

export interface LemmaMeaningsDto {
  languageCode: string;
  lemma: string;
  senses: WordSenseDto[];
}

export interface TokenAnalysisDto {
  lexemeId: string;
  lemma: string;
  partOfSpeech: string | null;
  features: Record<string, string>;
}

export interface TokenLookupDto {
  languageCode: string;
  token: string;
  analyses: TokenAnalysisDto[];
}
