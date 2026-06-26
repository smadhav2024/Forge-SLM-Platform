"""
6-Layer Dataset Processing Pipeline for Forge Fine-Tuning Platform.

Layer 1 : Universal File Ingestion  (CSV, JSON, JSONL, PDF, TXT, DOCX)
Layer 2 : Automated Schema Detection (instruction | chat_log | unstructured_prose | jsonl_messages)
Layer 3 : Automated Cleaning Pipeline (dedup, quality filters, PII scrubbing)
Layer 4 : Hybrid Task Formatting      (text splitting + heuristic Q&A synthesis)
Layer 5 : Summary compilation
Layer 6 : Dynamic LoRA configuration
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import random
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── PII patterns ────────────────────────────────────────────────────────────
_PII = [
    (re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'), '[EMAIL]'),
    (re.compile(r'\b(?:\+?1[-.\\s]?)?(?:\(?\d{3}\)?[-.\\s]?)?\d{3}[-.\\s]?\d{4}\b'), '[PHONE]'),
    (re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'), '[IP_ADDRESS]'),
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN]'),
    (re.compile(r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b'), '[CC_NUM]'),
]

_INSTRUCTION_COL = re.compile(r'(?i)^(question|prompt|input|instruction)$')
_RESPONSE_COL    = re.compile(r'(?i)^(answer|response|output|completion)$')
_USER_ANCHOR     = re.compile(r'(?i)\[(user|human)\]\s*:', re.MULTILINE)
_ASSIST_ANCHOR   = re.compile(r'(?i)\[(assistant|ai|bot)\]\s*:', re.MULTILINE)

# ── Noise / junk patterns ─────────────────────────────────────────────────────
# Matches strings that are mostly non-word characters or random keyboard mashing
_GIBBERISH_RE = re.compile(r'^[a-z]{3,20}$', re.IGNORECASE)  # catches "long", "askdjfhaskdf"
_SQL_INJECTION_RE = re.compile(r'(?i)(SELECT\s+\*\s+FROM|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|--\s*$)', re.MULTILINE)
_CORRUPT_UNICODE_RE = re.compile(r'â€[™œ\w]|Ã[^\s]{1,3}|\x00|\ufffd')
_TEMPLATE_TEXT_RE = re.compile(r'^(COMPANY POLICY MANUAL SECTION|BENEFITS OVERVIEW \d{4}:)', re.IGNORECASE)
_REPEATED_WORD_RE = re.compile(r'^(\b\w+\b)(\s+\1){4,}$')  # "word word word word word..."


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _row_id(text: str, salt: str = "") -> str:
    return hashlib.md5(f"{salt}{text}".encode()).hexdigest()[:12]


def _scrub_pii(text: str) -> str:
    for pattern, repl in _PII:
        text = pattern.sub(repl, text)
    return text


def _char_entropy(text: str) -> float:
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for c in text:
        freq[c] = freq.get(c, 0) + 1
    total = len(text)
    return -sum((v / total) * math.log2(v / total) for v in freq.values())


def _normalize_question(text: str) -> str:
    """
    Strip trailing single/double chars that differ between near-duplicate questions.
    e.g. 'What is the PTO policy? z"' and 'What is the PTO policy? w"' → same canonical form.
    """
    # Remove trailing punctuation + stray letter combos like: z", w", x', abc"
    cleaned = re.sub(r'\s*[a-zA-Z]{1,3}["\']?\s*$', '', text.rstrip())
    # Also strip trailing standalone quote chars
    cleaned = cleaned.rstrip('"\'').rstrip()
    return cleaned


def _is_junk_pair(instruction: str, response: str) -> tuple[bool, str]:
    """
    Returns (is_junk, reason). Detects various noise patterns in the dataset.
    """
    inst = instruction.strip()
    resp = response.strip()

    # Missing or null fields
    if not inst or inst.lower() in ('nan', 'null', 'none', ''):
        return True, 'missing_instruction'
    if not resp or resp.lower() in ('nan', 'null', 'none', ''):
        return True, 'missing_response'

    # Single char / trivially short
    if len(inst) < 10 or len(resp) < 10:
        return True, 'too_short'

    # Corrupted unicode
    if _CORRUPT_UNICODE_RE.search(inst) or _CORRUPT_UNICODE_RE.search(resp):
        return True, 'corrupted_unicode'

    # SQL injection / code injection junk
    if _SQL_INJECTION_RE.search(inst) or _SQL_INJECTION_RE.search(resp):
        return True, 'sql_injection'

    # Raw policy manual blobs used as instruction (no question form)
    if _TEMPLATE_TEXT_RE.match(inst):
        return True, 'unformatted_policy_blob'

    # Repeated word padding e.g. "word word word word word..."
    if _REPEATED_WORD_RE.match(resp):
        return True, 'repeated_word_padding'

    # Random keyboard mash (low alpha diversity, no spaces, short)
    if len(inst) < 30 and re.match(r'^[a-z]+$', inst, re.IGNORECASE) and _char_entropy(inst) < 2.5:
        return True, 'possible_gibberish'

    return False, ''


# ─────────────────────────────────────────────────────────────────────────────
# Layer 1: Universal File Ingestion
# ─────────────────────────────────────────────────────────────────────────────

def ingest_file(file_path: str, original_filename: str) -> tuple[list[dict], str]:
    """Returns (rows, raw_format). Each row has at least a 'text' key."""
    ext = Path(original_filename).suffix.lower()
    if ext in ('.csv',):
        return _ingest_csv(file_path), 'csv'
    elif ext in ('.xlsx', '.xls'):
        return _ingest_excel(file_path), 'excel'
    elif ext == '.pdf':
        return _ingest_pdf(file_path), 'pdf'
    elif ext in ('.docx', '.doc'):
        return _ingest_docx(file_path), 'docx'
    elif ext == '.jsonl':
        return _ingest_jsonl(file_path), 'jsonl'
    elif ext == '.json':
        return _ingest_json(file_path), 'json'
    else:
        return _ingest_text(file_path), 'txt'


def _ingest_csv(path: str) -> list[dict]:
    try:
        import pandas as pd
        df = pd.read_csv(path, encoding='utf-8', on_bad_lines='skip').dropna(how='all').fillna('')
        rows = []
        for _, row in df.iterrows():
            d = row.to_dict()
            text = ' | '.join(f"{k}: {v}" for k, v in d.items() if str(v).strip())
            rows.append({'text': text, 'raw': d})
        return rows
    except Exception as e:
        logger.error("CSV ingest: %s", e)
        return []


def _ingest_excel(path: str) -> list[dict]:
    try:
        import pandas as pd
        df = pd.read_excel(path).dropna(how='all').fillna('')
        rows = []
        for _, row in df.iterrows():
            d = row.to_dict()
            text = ' | '.join(f"{k}: {v}" for k, v in d.items() if str(v).strip())
            rows.append({'text': text, 'raw': d})
        return rows
    except Exception as e:
        logger.error("Excel ingest: %s", e)
        return []


def _ingest_pdf(path: str) -> list[dict]:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(path)
        rows = []
        for i, page in enumerate(doc):
            text = page.get_text("text").replace('\x00', '').strip()
            text = re.sub(r'\n{3,}', '\n\n', text)
            if text:
                rows.append({'text': text, 'page': i + 1})
        doc.close()
        return rows
    except Exception as e:
        logger.error("PDF ingest: %s", e)
        return []


def _ingest_docx(path: str) -> list[dict]:
    try:
        from docx import Document
        doc = Document(path)
        rows, buf = [], []
        for para in doc.paragraphs:
            t = para.text.strip()
            if t:
                buf.append(t)
            elif buf:
                rows.append({'text': ' '.join(buf)})
                buf = []
        if buf:
            rows.append({'text': ' '.join(buf)})
        return rows
    except Exception as e:
        logger.error("DOCX ingest: %s", e)
        return []


def _ingest_jsonl(path: str) -> list[dict]:
    rows = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if 'messages' in obj and isinstance(obj['messages'], list):
                    text = ' '.join(m.get('content', '') for m in obj['messages'])
                    rows.append({'text': text, 'messages': obj['messages'], '_structured': True})
                elif any(_INSTRUCTION_COL.match(k) for k in obj):
                    instruction = next((v for k, v in obj.items() if _INSTRUCTION_COL.match(k)), '')
                    response = next((v for k, v in obj.items() if _RESPONSE_COL.match(k)), '')
                    text = f"{instruction} {response}".strip()
                    rows.append({'text': text, 'raw': obj, '_structured': True})
                else:
                    rows.append({'text': json.dumps(obj, ensure_ascii=False)})
            except json.JSONDecodeError:
                rows.append({'text': line})
    return rows


def _ingest_json(path: str) -> list[dict]:
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return [{'text': json.dumps(item, ensure_ascii=False) if isinstance(item, dict) else str(item),
                     'raw': item if isinstance(item, dict) else None}
                    for item in data]
        return [{'text': json.dumps(data, ensure_ascii=False), 'raw': data}]
    except Exception as e:
        logger.error("JSON ingest: %s", e)
        return []


def _ingest_text(path: str) -> list[dict]:
    try:
        with open(path, encoding='utf-8', errors='replace') as f:
            content = f.read()
        paras = [p.strip() for p in re.split(r'\n{2,}', content) if p.strip()]
        return [{'text': p} for p in paras]
    except Exception as e:
        logger.error("Text ingest: %s", e)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2: Schema Detection
# ─────────────────────────────────────────────────────────────────────────────

def detect_schema(rows: list[dict], raw_format: str) -> str:
    """Returns one of: jsonl_messages | instruction | chat_log | unstructured_prose"""
    if not rows:
        return 'unstructured_prose'

    first = rows[0]

    # Pre-structured JSONL with messages
    if first.get('_structured') and 'messages' in first:
        return 'jsonl_messages'

    # Pre-structured with instruction columns
    if first.get('_structured') and isinstance(first.get('raw'), dict):
        keys = list(first['raw'].keys())
        if any(_INSTRUCTION_COL.match(str(k)) for k in keys) and \
           any(_RESPONSE_COL.match(str(k)) for k in keys):
            return 'instruction'

    # CSV with instruction/response headers
    if raw_format in ('csv', 'excel') and isinstance(first.get('raw'), dict):
        keys = list(first['raw'].keys())
        if any(_INSTRUCTION_COL.match(str(k)) for k in keys) and \
           any(_RESPONSE_COL.match(str(k)) for k in keys):
            return 'instruction'

    # Chat-log pattern scan
    sample = ' '.join(r.get('text', '') for r in rows[:30])
    if _USER_ANCHOR.search(sample) and _ASSIST_ANCHOR.search(sample):
        return 'chat_log'

    return 'unstructured_prose'


# ─────────────────────────────────────────────────────────────────────────────
# Layer 3: Cleaning Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def clean_dataset(
    rows: list[dict],
    dedup_threshold: float = 0.85,
) -> tuple[list[dict], list[dict]]:
    """Returns (clean_rows, quarantine_rows). Quarantine rows include 'rejection_reason'."""
    clean: list[dict] = []
    quarantine: list[dict] = []

    # 1. Assign IDs, scrub PII, length gate, and smart junk detection
    for i, row in enumerate(rows):
        text = row.get('text', '')
        row['_id'] = _row_id(f"{i}:{text[:200]}")

        # If this is an instruction/response pair, run smart junk detection
        raw = row.get('raw', {})
        if isinstance(raw, dict):
            instruction_val = next((str(v) for k, v in raw.items() if _INSTRUCTION_COL.match(str(k))), None)
            response_val    = next((str(v) for k, v in raw.items() if _RESPONSE_COL.match(str(k))), None)
            if instruction_val is not None and response_val is not None:
                is_junk, reason = _is_junk_pair(instruction_val, response_val)
                if is_junk:
                    quarantine.append({**row, 'rejection_reason': reason})
                    continue

        if len(text) < 20:
            quarantine.append({**row, 'rejection_reason': 'too_short'})
            continue

        # Corrupted unicode in raw text
        if _CORRUPT_UNICODE_RE.search(text):
            quarantine.append({**row, 'rejection_reason': 'corrupted_unicode'})
            continue

        row['text'] = _scrub_pii(text)
        clean.append(row)

    if not clean:
        return [], quarantine

    # 2. Extreme-length filter: 4× the 95th percentile
    lengths = sorted(len(r['text']) for r in clean)
    p95 = lengths[max(0, int(len(lengths) * 0.95) - 1)]
    max_len = max(p95 * 4, 2000)  # floor at 2000 chars
    after_len = []
    for r in clean:
        if len(r['text']) > max_len:
            quarantine.append({**r, 'rejection_reason': 'too_long'})
        else:
            after_len.append(r)
    clean = after_len

    # 3. Entropy / gibberish gate
    if clean:
        ents = [_char_entropy(r['text']) for r in clean]
        mean_e = sum(ents) / len(ents)
        std_e = (sum((e - mean_e) ** 2 for e in ents) / len(ents)) ** 0.5 if len(ents) > 1 else 1.0
        after_gb = []
        for row, e in zip(clean, ents):
            if e < mean_e - 3 * std_e and mean_e > 2.5:
                quarantine.append({**row, 'rejection_reason': 'possible_gibberish'})
            else:
                after_gb.append(row)
        clean = after_gb

    # 4. Near-duplicate detection with canonical question normalization
    #    Normalize trailing-char variants BEFORE MinHash so "Q? z" == "Q? w"
    def _canonical_text(row: dict) -> str:
        raw = row.get('raw', {})
        if isinstance(raw, dict):
            inst = next((str(v) for k, v in raw.items() if _INSTRUCTION_COL.match(str(k))), '')
            if inst:
                return _normalize_question(inst).lower()
        return _normalize_question(row.get('text', '')).lower()

    # Exact-canonical dedup first (catches the trailing-char variants cheaply)
    seen_canonical: dict[str, str] = {}  # canonical → _id of first seen
    exact_deduped: list[dict] = []
    for row in clean:
        canon = _canonical_text(row)
        if canon in seen_canonical:
            quarantine.append({**row, 'rejection_reason': 'near_duplicate'})
        else:
            seen_canonical[canon] = row['_id']
            exact_deduped.append(row)
    clean = exact_deduped

    # 5. MinHash LSH for fuzzy near-duplicate detection
    try:
        from datasketch import MinHash, MinHashLSH
        num_perm = 128
        lsh = MinHashLSH(threshold=dedup_threshold, num_perm=num_perm)
        deduped: list[dict] = []
        for row in clean:
            m = MinHash(num_perm=num_perm)
            for word in set(row['text'].lower().split()):
                m.update(word.encode())
            if lsh.query(m):
                quarantine.append({**row, 'rejection_reason': 'near_duplicate'})
            else:
                lsh.insert(row['_id'], m)
                deduped.append(row)
        clean = deduped
    except ImportError:
        logger.warning("datasketch not installed — skipping fuzzy deduplication")

    return clean, quarantine


# ─────────────────────────────────────────────────────────────────────────────
# Layer 4: Hybrid Task Formatting
# ─────────────────────────────────────────────────────────────────────────────

def _heuristic_qa_from_chunk(chunk: str) -> list[dict]:
    """
    Extracts Q&A pairs from a text chunk using heuristics.
    Falls back to sentence-level decomposition.
    """
    pairs = []

    # Try heading → content pattern (Markdown / document sections)
    heading_re = re.compile(r'^#+\s+(.+)$', re.MULTILINE)
    headings = heading_re.findall(chunk)
    if headings:
        for h in headings[:3]:
            pairs.append({
                'instruction': f"What does the document say about '{h}'?",
                'response': chunk[:600].strip(),
            })
        return pairs

    # Sentence decomposition — use declarative sentences as answers
    sentences = re.split(r'(?<=[.!?])\s+', chunk.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 40]
    for sent in sentences[:3]:
        m = re.match(r'^(.{5,50}?)\s+(?:is|are|was|were|can|will|should)\s+', sent)
        if m:
            subject = m.group(1).strip().rstrip(',')
            pairs.append({'instruction': f"What is {subject}?", 'response': sent})
        else:
            pairs.append({
                'instruction': f"Explain the following: {sent[:80].rstrip('.')}.",
                'response': sent,
            })

    if not pairs:
        pairs.append({
            'instruction': f"Summarize the following passage in one sentence: {chunk[:300]}...",
            'response': chunk[:500],
        })

    return pairs


def format_rows(
    rows: list[dict],
    schema_type: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[dict]:
    """Converts cleaned rows into ChatML message-list dicts ready for JSONL output."""
    output: list[dict] = []

    if schema_type == 'jsonl_messages':
        for row in rows:
            if 'messages' in row:
                output.append({'messages': row['messages'], '_id': row.get('_id', '')})

    elif schema_type == 'instruction':
        for row in rows:
            raw = row.get('raw', {})
            if not isinstance(raw, dict):
                continue
            instruction = next((str(v) for k, v in raw.items() if _INSTRUCTION_COL.match(str(k))), '')
            response    = next((str(v) for k, v in raw.items() if _RESPONSE_COL.match(str(k))),    '')
            # Normalize trailing-char noise from instruction
            instruction = _normalize_question(instruction)
            if instruction and response:
                output.append({
                    'messages': [
                        {'role': 'user',      'content': instruction},
                        {'role': 'assistant', 'content': response},
                    ],
                    '_id': row.get('_id', ''),
                })

    elif schema_type == 'chat_log':
        for row in rows:
            text     = row.get('text', '')
            roles_r  = re.findall(r'(?i)\[(user|human|assistant|ai|bot)\]\s*:', text)
            segments = re.split(r'(?i)\[(user|human|assistant|ai|bot)\]\s*:', text)
            messages = []
            for role_raw, content in zip(roles_r, segments[1:]):
                role = 'user' if role_raw.lower() in ('user', 'human') else 'assistant'
                content = content.strip()
                if content:
                    messages.append({'role': role, 'content': content})
            if len(messages) >= 2:
                output.append({'messages': messages, '_id': row.get('_id', '')})

    elif schema_type == 'unstructured_prose':
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
            )
            split_fn = splitter.split_text
        except ImportError:
            def split_fn(text: str) -> list[str]:  # type: ignore[misc]
                words = text.split()
                chunks = []
                step = max(1, chunk_size - chunk_overlap)
                for i in range(0, len(words), step):
                    chunk = ' '.join(words[i: i + chunk_size])
                    if chunk:
                        chunks.append(chunk)
                return chunks

        for row in rows:
            text   = row.get('text', '')
            chunks = split_fn(text)
            for chunk in chunks:
                chunk = chunk.strip()
                if len(chunk) < 50:
                    continue
                qa_pairs = _heuristic_qa_from_chunk(chunk)
                for qa in qa_pairs:
                    output.append({
                        'messages': [
                            {'role': 'user',      'content': qa['instruction']},
                            {'role': 'assistant', 'content': qa['response']},
                        ],
                        '_id': _row_id(chunk[:100]),
                    })

    return output


# ─────────────────────────────────────────────────────────────────────────────
# Layer 5 helpers: JSONL I/O
# ─────────────────────────────────────────────────────────────────────────────

def write_jsonl(pairs: list[dict], path: str) -> int:
    """Writes training pairs to JSONL (keeps _id for review; trainer ignores extra keys)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    count = 0
    with open(path, 'w', encoding='utf-8') as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False, default=str) + '\n')
            count += 1
    return count


def write_quarantine(rows: list[dict], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, default=str) + '\n')


# ─────────────────────────────────────────────────────────────────────────────
# Layer 6: Dynamic LoRA Config
# ─────────────────────────────────────────────────────────────────────────────

def generate_lora_config(row_count: int) -> dict:
    if row_count < 1_000:
        return {
            'r': 4, 'lora_alpha': 8,
            'target_modules': ['q_proj', 'v_proj'],
            'lora_dropout': 0.05, 'bias': 'none', 'task_type': 'CAUSAL_LM',
            'recommendation': 'Small dataset — low rank prevents overfitting.',
        }
    elif row_count <= 10_000:
        return {
            'r': 8, 'lora_alpha': 16,
            'target_modules': ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
            'lora_dropout': 0.05, 'bias': 'none', 'task_type': 'CAUSAL_LM',
            'recommendation': 'Medium dataset — balanced rank for good generalisation.',
        }
    else:
        return {
            'r': 16, 'lora_alpha': 32,
            'target_modules': ['q_proj', 'v_proj', 'k_proj', 'o_proj',
                               'gate_proj', 'up_proj', 'down_proj'],
            'lora_dropout': 0.05, 'bias': 'none', 'task_type': 'CAUSAL_LM',
            'recommendation': 'Large dataset — high rank with all linear layers for complex domain features.',
        }


# ─────────────────────────────────────────────────────────────────────────────
# Main Pipeline Entry-point
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(
    file_path: str,
    original_filename: str,
    output_path: str,
    quarantine_path: str,
    dedup_threshold: float = 0.85,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> dict:
    """
    Runs all 6 layers synchronously. Designed to run in asyncio.to_thread().
    Returns a summary dict consumed by the /process route.
    """
    logs: list[str] = []

    def log(msg: str) -> None:
        logs.append(msg)
        logger.info(msg)

    log(f"Layer 1 · Ingesting {original_filename}…")
    rows, raw_fmt = ingest_file(file_path, original_filename)
    log(f"  → {len(rows)} raw segments ({raw_fmt.upper()})")

    log("Layer 2 · Detecting schema…")
    schema = detect_schema(rows, raw_fmt)
    log(f"  → {schema}")

    log("Layer 3 · Cleaning…")
    clean, quarantine = clean_dataset(rows, dedup_threshold=dedup_threshold)
    dup_count = sum(1 for r in quarantine if r.get('rejection_reason') == 'near_duplicate')
    log(f"  → kept {len(clean)}, quarantined {len(quarantine)} (dups: {dup_count})")

    log("Layer 4 · Formatting into training pairs…")
    pairs = format_rows(clean, schema, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    log(f"  → {len(pairs)} pairs")

    log("Layer 5 · Writing JSONL files…")
    row_count = write_jsonl(pairs, output_path)
    write_quarantine(quarantine, quarantine_path)
    log(f"  → {row_count} rows written")

    log("Layer 6 · Computing LoRA config…")
    lora = generate_lora_config(row_count)
    log(f"  → r={lora['r']}, alpha={lora['lora_alpha']}")

    # Build 5-sample preview
    sample_idx = random.sample(range(len(pairs)), min(5, len(pairs)))
    previews = [
        {
            '_id': pairs[i].get('_id', str(i)),
            'messages': pairs[i].get('messages', []),
        }
        for i in sample_idx
    ]

    return {
        'schema_type':      schema,
        'total_rows_raw':   len(rows),
        'total_rows_clean': row_count,
        'rows_removed':     len(quarantine),
        'duplicate_count':  dup_count,
        'lora_config':      lora,
        'preview_samples':  previews,
        'logs':             logs,
    }