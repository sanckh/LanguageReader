import type { ReadingMode } from '../models/readingMode';

export interface AssistanceAnchor {
  section_id: string;
  start_offset: number;
  end_offset: number;
}
export interface AssistanceState {
  attempt: string;
  revealed: boolean;
  translation: string | null;
  vocabulary_help: Record<string, unknown>;
}
export interface ReaderStateAccess {
  load: (anchor: AssistanceAnchor) => Promise<AssistanceState>;
  save: (anchor: AssistanceAnchor, state: AssistanceState) => void;
}
export interface ReaderSettings {
  mode: ReadingMode;
}
