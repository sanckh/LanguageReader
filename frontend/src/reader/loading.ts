export function needsMoreSections(
  currentPage: number,
  loadedPages: number,
  loadedSections: number,
  totalSections: number,
  savedSectionPosition?: number,
): boolean {
  if (loadedSections >= totalSections) return false;
  if (
    savedSectionPosition !== undefined &&
    savedSectionPosition >= loadedSections
  )
    return true;
  return loadedSections < 31 || loadedPages - currentPage - 1 <= 3;
}
