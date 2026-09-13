# Linguistic data extraction

Offline jobs that produce Polish linguistic data for the word-lookup pipeline
(Trello cards 28–30). Each job runs in Docker, writes plain data files to a local
`out/` folder, and touches **no database**. A separate backend script then loads
those files into Supabase.

Why the split: the containers only need the internet to download open datasets,
never your Supabase keys. All database writes go through the backend's existing
service-role import scripts.

## Card 29 — Polish → English meanings (plWordNet via Open Multilingual Wordnet)

Source: [Open Multilingual Wordnet](https://github.com/omwn/omw-data)'s `omw-pl`
(plWordNet) mapped to Princeton WordNet (`omw-en`) through the interlingual
index. Interim source while CLARIN-PL's full plWordNet 4.5 download is offline;
the output shape is identical, so switching later is just a re-run. License:
Princeton WordNet license (commercial use allowed).

### 1. Extract the data (Docker)

From this `linguistics/` folder:

```bash
docker build -t language-reader-linguistics .
```

Then run it, mounting a local `out/` folder for the result and a cache folder so
the wordnet download is reused on repeat runs:

```bash
docker run --rm -v "$(pwd)/out:/out" -v "$(pwd)/.wn_cache:/wn_data" language-reader-linguistics
```

On Windows PowerShell:

```powershell
docker run --rm -v "${PWD}\out:/out" -v "${PWD}\.wn_cache:/wn_data" language-reader-linguistics
```

In Docker Desktop (GUI): build the image from this folder, then run it with two
volume/bind mounts — host `out` → container `/out`, and host `.wn_cache` →
container `/wn_data`. No environment variables or ports are needed.

Result: `out/meanings.jsonl`, one candidate sense per line, e.g.

```json
{"lemma": "zamek", "pos": "noun", "gloss": "castle", "source": "omw-pl:2.0->omw-en:2.0"}
```

### 2. Load it into Supabase (backend)

From `backend/` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in
`.env.local`, same as the other import scripts):

```bash
npm run import:lexicon ../linguistics/out/meanings.jsonl pl
```

Idempotent — safe to re-run after a data refresh; it inserts only new lexemes and
meanings. Verify with the endpoint once loaded:

```
GET /api/language/pl/meanings?lemma=zamek
```

## Card 28 — Polish morphology (Morfeusz 2)

Resolves a surface form to its lemma, part of speech, and grammatical features.
Source: the `morfeusz2` PyPI wheel, which bundles the Morfeusz engine and its
SGJP + PoliMorf dictionaries (2-clause BSD, commercial use allowed) — no separate
install or your local Morfeusz download needed for the container.

Only the word forms that actually appear in the library are analysed, so the
first step exports that token list from Supabase.

### 1. Export the corpus tokens (backend)

From `backend/` (needs Supabase keys in `.env.local`):

```bash
npm run export:tokens ../linguistics/out/tokens.txt pl
```

### 2. Analyse them with Morfeusz (Docker)

Reuse the image built for card 29 (rebuild if you haven't: `docker build -t
language-reader-linguistics .`). Override the command to run the analyser:

```bash
docker run --rm -v "$(pwd)/out:/out" language-reader-linguistics \
  analyze_tokens.py --in /out/tokens.txt --out /out/analyses.jsonl
```

Windows PowerShell:

```powershell
docker run --rm -v "${PWD}\out:/out" language-reader-linguistics analyze_tokens.py --in /out/tokens.txt --out /out/analyses.jsonl
```

Result: `out/analyses.jsonl`, one reading per line, e.g.

```json
{"form": "zamkiem", "lemma": "zamek", "pos": "noun", "features": {"number": "sg", "case": "inst", "gender": "m3"}}
```

### 3. Load it into Supabase (backend)

```bash
npm run import:morphology ../linguistics/out/analyses.jsonl pl
```

Idempotent. Verify with the endpoint (forms are cached lowercased):

```
GET /api/language/pl/analyze?token=zamkiem
```

Once both card 28 and 29 data are loaded, the two compose: analyse a tapped form
to its lemma, then look up that lemma's meanings.
