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

// One candidate sense for a looked-up lemma. Homonyms are distinct lexemes that
// share a spelling, so a single lemma can yield several senses across lexemes.
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

// One morphological reading of a surface form. A form can have several readings
// (morphological ambiguity), returned as candidates rather than guessed between.
// `features` is a language-neutral bag (case, gender, number, tense, aspect, …)
// so the shape stays reusable across languages.
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
