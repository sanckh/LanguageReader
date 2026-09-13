"""Extract Polish lemma -> English gloss pairs from Open Multilingual Wordnet.

Runs entirely offline (no database access): it writes a JSONL file that the Node
import script (`npm run import:lexicon`) loads into Supabase. This keeps database
credentials out of the container.

Each output line is one candidate sense:
    {"lemma": "zamek", "pos": "noun", "gloss": "castle", "source": "omw-pl:2.0"}

The English gloss is resolved by following each Polish synset's interlingual
index (ILI) to the matching English (Princeton) synset and taking its lemmas —
i.e. the English words that share the concept. This is the plWordNet -> Princeton
mapping; when full plWordNet 4.5 becomes available it replaces the source with
the same output shape.
"""

import argparse
import json
import os
import sys

import wn

# Wordnet POS codes -> the coarse, human-readable set we store (kept consistent
# with what the Morfeusz importer will emit, so a POS hint filters across both).
POS = {
    "n": "noun",
    "v": "verb",
    "a": "adjective",
    "s": "adjective",  # adjective satellite
    "r": "adverb",
}


def project_id(spec: str) -> str:
    return spec.split(":")[0]


def ensure_installed(spec: str) -> str:
    """Install the project if absent and return its concrete id:version.

    Accepts a bare id ("omw-pl") or a pinned spec ("omw-pl:1.4"); a bare id lets
    wn choose whatever version its bundled index actually offers, so the job does
    not break when a specific version isn't published for this wn release.
    """
    pid = project_id(spec)
    installed = next(
        (
            lex.specifier()
            for lex in wn.lexicons()
            if project_id(lex.specifier()) == pid
        ),
        None,
    )
    if installed:
        return installed
    print(f"Downloading {spec} ...", file=sys.stderr)
    wn.download(spec)
    resolved = next(
        (
            lex.specifier()
            for lex in wn.lexicons()
            if project_id(lex.specifier()) == pid
        ),
        None,
    )
    if not resolved:
        raise SystemExit(f"{spec} is not installed after download")
    return resolved


def english_glosses(english: wn.Wordnet, ili_id: str) -> list[str]:
    glosses: list[str] = []
    for synset in english.synsets(ili=ili_id):
        for lemma in synset.lemmas():
            text = lemma.replace("_", " ").strip()
            if text and text not in glosses:
                glosses.append(text)
    return glosses


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="omw-pl", help="Polish wordnet id")
    parser.add_argument(
        "--english", default="omw-en", help="English wordnet id (ILI target)"
    )
    parser.add_argument(
        "--out", default="/out/meanings.jsonl", help="output JSONL path"
    )
    args = parser.parse_args()

    source_spec = ensure_installed(args.source)
    english_spec = ensure_installed(args.english)

    polish = wn.Wordnet(source_spec)
    english = wn.Wordnet(english_spec)
    source_tag = f"{source_spec}->{english_spec}"

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    written = 0
    skipped = 0
    with open(args.out, "w", encoding="utf-8") as handle:
        for word in polish.words():
            lemma = word.lemma().strip()
            if not lemma:
                continue
            pos = POS.get(word.pos)
            for synset in word.synsets():
                ili = synset.ili
                if ili is None:
                    skipped += 1
                    continue
                # wn >=0.11 exposes the ILI as a plain string; older releases as
                # an object with an `.id`. Accept either.
                ili_id = ili if isinstance(ili, str) else ili.id
                for gloss in english_glosses(english, ili_id):
                    handle.write(
                        json.dumps(
                            {
                                "lemma": lemma,
                                "pos": pos,
                                "gloss": gloss,
                                "source": source_tag,
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                    written += 1

    print(
        f"Wrote {written} senses to {args.out} "
        f"({skipped} Polish synsets had no interlingual link)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
