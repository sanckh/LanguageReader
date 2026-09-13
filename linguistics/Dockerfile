# Offline linguistic data extraction. Produces JSONL files under /out that the
# backend import scripts load into Supabase. No database credentials needed here.
FROM python:3.12-slim

WORKDIR /app

# wn stores downloaded wordnets under this directory; mounting it as a volume
# lets repeated runs reuse the download instead of fetching it every time.
ENV WN_DATA_DIR=/wn_data

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY extract_meanings.py analyze_tokens.py ./

# Runs any extractor script; the default produces meanings. For Morfeusz analysis
# override the command, e.g.:
#   docker run ... IMAGE analyze_tokens.py --in /out/tokens.txt --out /out/analyses.jsonl
ENTRYPOINT ["python"]
CMD ["extract_meanings.py", "--out", "/out/meanings.jsonl"]
