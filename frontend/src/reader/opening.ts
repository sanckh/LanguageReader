import type { DocumentOpening } from '../interfaces/document';

let opening: DocumentOpening | undefined;

export function rememberOpening(value: DocumentOpening): void {
  opening = value;
}

export function takeOpening(id: string): DocumentOpening | undefined {
  if (opening?.document.id !== id) return undefined;
  return opening;
}
