"""Analyse Polish surface forms with Morfeusz 2 into normalized readings.

Offline (no database): reads a token list (one form per line) and writes a JSONL
file that the Node import script (`npm run import:morphology`) loads into the
surface_form cache. Keeps database credentials out of the container.

Each output line is one morphological reading of a form:
    {"form": "zamkiem", "lemma": "zamek", "pos": "noun",
     "features": {"number": "sg", "case": "inst", "gender": "m3"}}

Morfeusz returns colon-separated positional tags (e.g. "subst:sg:inst:m3"); the
tag parser below maps the class to a coarse part of speech (kept consistent with
the meaning importer) and the remaining fields to a language-neutral feature bag.
"""

import argparse
import json
import sys

import morfeusz2

# Morfeusz tag class -> coarse part of speech. Verb-family classes all collapse
# to "verb"; the finer class still informs tense below.
POS = {
    "subst": "noun",
    "depr": "noun",
    "adj": "adjective",
    "adja": "adjective",
    "adjc": "adjective",
    "adjp": "adjective",
    "adv": "adverb",
    "ppron12": "pronoun",
    "ppron3": "pronoun",
    "siebie": "pronoun",
    "num": "numeral",
    "numcol": "numeral",
    "prep": "preposition",
    "conj": "conjunction",
    "comp": "conjunction",
    "qub": "particle",
    "brev": "abbreviation",
    "interj": "interjection",
    "interp": "punctuation",
    "fin": "verb",
    "bedzie": "verb",
    "aglt": "verb",
    "praet": "verb",
    "impt": "verb",
    "imps": "verb",
    "inf": "verb",
    "pcon": "verb",
    "pant": "verb",
    "ger": "verb",
    "pact": "verb",
    "ppas": "verb",
    "winien": "verb",
    "pred": "verb",
}

_CASES = ["nom", "gen", "dat", "acc", "inst", "loc", "voc"]
_NUMBERS = ["sg", "pl"]
_GENDERS = ["m1", "m2", "m3", "f", "n", "n1", "n2", "p1", "p2", "p3"]
_PERSONS = ["pri", "sec", "ter"]
_DEGREES = ["pos", "com", "sup"]
_ASPECTS = ["imperf", "perf"]

VALUE_CATEGORY: dict[str, str] = {}
for _value in _CASES:
    VALUE_CATEGORY[_value] = "case"
for _value in _NUMBERS:
    VALUE_CATEGORY[_value] = "number"
for _value in _GENDERS:
    VALUE_CATEGORY[_value] = "gender"
for _value in _PERSONS:
    VALUE_CATEGORY[_value] = "person"
for _value in _DEGREES:
    VALUE_CATEGORY[_value] = "degree"
for _value in _ASPECTS:
    VALUE_CATEGORY[_value] = "aspect"

TENSE_BY_CLASS = {"praet": "past", "fin": "present", "bedzie": "future"}


def parse_tag(tag: str) -> tuple[str, dict[str, str]]:
    fields = tag.split(":")
    cls = fields[0]
    pos = POS.get(cls, "other")
    features: dict[str, str] = {}
    for field in fields[1:]:
        # A field may list alternatives separated by "." (e.g. "nom.acc.voc").
        value = field.split(".")[0]
        category = VALUE_CATEGORY.get(value)
        if category and category not in features:
            features[category] = value
    tense = TENSE_BY_CLASS.get(cls)
    if tense and "tense" not in features:
        features["tense"] = tense
    return pos, features


def whole_form_readings(morf: "morfeusz2.Morfeusz", token: str) -> list[tuple]:
    analyses = morf.analyse(token)
    if not analyses:
        return []
    last = max(end for _start, end, _interp in analyses)
    # Keep only readings that span the whole token, dropping agglutinative
    # sub-segmentations (e.g. the "-śmy" split off "zrobiliśmy").
    return [
        interp
        for start, end, interp in analyses
        if start == 0 and end == last
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--in", dest="infile", default="/out/tokens.txt", help="token list path"
    )
    parser.add_argument(
        "--out", default="/out/analyses.jsonl", help="output JSONL path"
    )
    args = parser.parse_args()

    morf = morfeusz2.Morfeusz()
    written = 0
    unknown = 0
    with (
        open(args.infile, encoding="utf-8") as tokens,
        open(args.out, "w", encoding="utf-8") as handle,
    ):
        for line in tokens:
            token = line.strip().lower()
            if not token:
                continue
            seen: set[str] = set()
            emitted_any = False
            for interp in whole_form_readings(morf, token):
                lemma = interp[1].split(":")[0].strip()
                tag = interp[2]
                if tag == "ign" or not lemma:
                    continue
                pos, features = parse_tag(tag)
                key = f"{lemma}\t{pos}\t{json.dumps(features, sort_keys=True)}"
                if key in seen:
                    continue
                seen.add(key)
                handle.write(
                    json.dumps(
                        {
                            "form": token,
                            "lemma": lemma,
                            "pos": pos,
                            "features": features,
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                written += 1
                emitted_any = True
            if not emitted_any:
                unknown += 1

    print(
        f"Wrote {written} readings to {args.out} "
        f"({unknown} tokens had no known analysis)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
