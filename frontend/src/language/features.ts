// Turn a raw grammatical-feature bag (as produced by the analyzer) into a human
// label like "genitive singular". Labels are per-language because the feature
// vocabulary is language-specific; an unmapped language falls back to raw codes,
// so this stays reusable as new languages are added.

type LabelMap = Record<string, Record<string, string>>;

const PL_LABELS: LabelMap = {
  case: {
    nom: 'nominative',
    gen: 'genitive',
    dat: 'dative',
    acc: 'accusative',
    inst: 'instrumental',
    loc: 'locative',
    voc: 'vocative',
  },
  number: { sg: 'singular', pl: 'plural' },
  gender: {
    m1: 'masculine',
    m2: 'masculine',
    m3: 'masculine',
    f: 'feminine',
    n: 'neuter',
    n1: 'neuter',
    n2: 'neuter',
    p1: 'plural',
    p2: 'plural',
    p3: 'plural',
  },
  person: { pri: 'first person', sec: 'second person', ter: 'third person' },
  degree: { pos: 'positive', com: 'comparative', sup: 'superlative' },
  aspect: { imperf: 'imperfective', perf: 'perfective' },
  tense: { past: 'past', present: 'present', future: 'future' },
};

const LABELS: Record<string, LabelMap> = { pl: PL_LABELS };

// Read order chosen so the label reads naturally: "third person present
// imperfective" for a verb, "genitive singular" for a noun.
const ORDER = [
  'person',
  'tense',
  'aspect',
  'case',
  'number',
  'gender',
  'degree',
];

export function describeForm(
  features: Record<string, string>,
  code = 'pl',
): string {
  const labels = LABELS[code] ?? {};
  const parts: string[] = [];
  for (const category of ORDER) {
    const value = features[category];
    if (!value) continue;
    parts.push(labels[category]?.[value] ?? value);
  }
  return parts.join(' ');
}
