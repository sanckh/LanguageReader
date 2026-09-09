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
