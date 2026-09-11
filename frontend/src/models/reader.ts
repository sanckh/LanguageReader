import type { SectionKind } from './document';

// A measurable unit handed to the packer: one section's rendered block with the
// height it occupies at the current content width. `topMargin` is the space
// above it (heading spacing vs. paragraph gap) and counts only when the block is
// not the first thing on its page.
export interface MeasuredBlock {
  sectionId: string;
  kind: SectionKind;
  text: string;
  height: number;
  topMargin: number;
}

// A block as placed on a page. A long paragraph can be split across pages, so a
// placed block may cover only part of the source text; `continuation` marks a
// fragment whose paragraph began on an earlier page (render with no indent).
export interface PlacedBlock {
  sectionId: string;
  kind: SectionKind;
  text: string;
  continuation: boolean;
}

export interface ReaderPage {
  blocks: PlacedBlock[];
}
