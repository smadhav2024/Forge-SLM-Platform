"""
6-Layer Dataset Processing Pipeline for Forge Fine-Tuning Platform.
"""
from __future__ import annotations

import base64
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

# ── PII patterns ─────────────────────────────────────────────────────────────
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

# ── Code / SQL detection (Strict) ─────────────────────────────────────────────
_CODE_SIGNALS = re.compile(
    r'(?i)\b(SELECT\s+.*?\s+FROM|INSERT\s+INTO|UPDATE\s+.*?\s+SET|DELETE\s+FROM|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE)\b'
    r'|def\s+\w+\s*\(.*\):|class\s+\w+.*:|import\s+[\w\.]+|from\s+[\w\.]+\s+import'
    r'|function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*='
    r'|#include\s*[<"]\w+[.h]?[>"]'
    r'|\bsudo\s+apt-get\b|\bnpm\s+install\b|\bpip\s+install\b',
    re.MULTILINE,
)

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
    if not text: return 0.0
    freq: dict[str, int] = {}
    for c in text: freq[c] = freq.get(c, 0) + 1
    total = len(text)
    return -sum((v / total) * math.log2(v / total) for v in freq.values())

def _is_code_like(text: str) -> bool:
    return bool(_CODE_SIGNALS.search(text))

# ─────────────────────────────────────────────────────────────────────────────
# Layer 1: Universal File Ingestion
# ─────────────────────────────────────────────────────────────────────────────
def ingest_file(file_path: str, original_filename: str) -> tuple[list[dict], str]:
    ext = Path(original_filename).suffix.lower()
    if ext in ('.csv',): return _ingest_csv(file_path), 'csv'
    elif ext in ('.xlsx', '.xls'): return _ingest_excel(file_path), 'excel'
    elif ext == '.pdf': return _ingest_pdf(file_path), 'pdf'
    elif ext in ('.docx', '.doc'): return _ingest_docx(file_path), 'docx'
    elif ext == '.jsonl': return _ingest_jsonl(file_path), 'jsonl'
    elif ext == '.json': return _ingest_json(file_path), 'json'
    else: return _ingest_text(file_path), 'txt'

def _ingest_csv(path: str) -> list[dict]:
    try:
        import pandas as pd
        try: df = pd.read_csv(path, encoding='utf-8', on_bad_lines='skip')
        except UnicodeDecodeError: df = pd.read_csv(path, encoding='latin-1', on_bad_lines='skip')
        df = df.dropna(how='all').fillna('')
        df = df.applymap(lambda x: str(x).strip() if not pd.isna(x) else '')
        rows = []
        for idx, row in df.iterrows():
            d = row.to_dict()
            text = ' | '.join(f"{k}: {v}" for k, v in d.items() if str(v).strip())
            rows.append({'text': text, 'raw': d, '_source_row': int(idx) + 2})
        return rows
    except Exception as e:
        logger.error("CSV ingest: %s", e)
        return []

def _ingest_excel(path: str) -> list[dict]:
    try:
        import pandas as pd
        df = pd.read_excel(path).dropna(how='all').fillna('')
        df = df.applymap(lambda x: str(x).strip() if not pd.isna(x) else '')
        rows = []
        for idx, row in df.iterrows():
            d = row.to_dict()
            text = ' | '.join(f"{k}: {v}" for k, v in d.items() if str(v).strip())
            rows.append({'text': text, 'raw': d, '_source_row': int(idx) + 2})
        return rows
    except Exception as e:
        logger.error("Excel ingest: %s", e)
        return []

def _ingest_pdf(path: str) -> list[dict]:
    try:
        import fitz
        doc = fitz.open(path)
        rows = []
        for i, page in enumerate(doc):
            text = page.get_text("text").replace('\x00', '').strip()
            if text: rows.append({'text': text, 'page': i + 1, '_source_row': i + 1})
        doc.close()
        return rows
    except Exception: return []

def _ingest_docx(path: str) -> list[dict]:
    try:
        from docx import Document
        doc = Document(path)
        rows, buf, para_num = [], [], 0
        for para in doc.paragraphs:
            t = para.text.strip()
            para_num += 1
            if t: buf.append(t)
            elif buf:
                rows.append({'text': ' '.join(buf), '_source_row': para_num})
                buf = []
        if buf: rows.append({'text': ' '.join(buf), '_source_row': para_num})
        return rows
    except Exception: return []

def _ingest_jsonl(path: str) -> list[dict]:
    rows = []
    with open(path, encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            try:
                obj = json.loads(line)
                if 'messages' in obj and isinstance(obj['messages'], list):
                    text = ' '.join(m.get('content', '') for m in obj['messages'])
                    rows.append({'text': text, 'messages': obj['messages'], '_structured': True, '_source_row': line_num})
                elif any(_INSTRUCTION_COL.match(k) for k in obj):
                    instruction = next((v for k, v in obj.items() if _INSTRUCTION_COL.match(k)), '')
                    response    = next((v for k, v in obj.items() if _RESPONSE_COL.match(k)), '')
                    rows.append({'text': f"{instruction} {response}".strip(), 'raw': obj, '_structured': True, '_source_row': line_num})
                else:
                    rows.append({'text': json.dumps(obj, ensure_ascii=False), '_source_row': line_num})
            except json.JSONDecodeError:
                rows.append({'text': line, '_source_row': line_num})
    return rows

def _ingest_json(path: str) -> list[dict]:
    try:
        with open(path, encoding='utf-8') as f: data = json.load(f)
        if isinstance(data, list):
            return [{'text': json.dumps(item, ensure_ascii=False) if isinstance(item, dict) else str(item),
                     'raw': item if isinstance(item, dict) else None, '_source_row': i + 1} for i, item in enumerate(data)]
        return [{'text': json.dumps(data, ensure_ascii=False), 'raw': data, '_source_row': 1}]
    except Exception: return []

def _ingest_text(path: str) -> list[dict]:
    try:
        with open(path, encoding='utf-8', errors='replace') as f: content = f.read()
        paras = [p.strip() for p in re.split(r'\n{2,}', content) if p.strip()]
        return [{'text': p, '_source_row': i + 1} for i, p in enumerate(paras)]
    except Exception: return []

# ─────────────────────────────────────────────────────────────────────────────
# Layer 2: Schema Detection
# ─────────────────────────────────────────────────────────────────────────────
def detect_schema(rows: list[dict], raw_format: str) -> str:
    if not rows: return 'unstructured_prose'
    first = rows[0]
    if first.get('_structured') and 'messages' in first: return 'jsonl_messages'
    if first.get('_structured') and isinstance(first.get('raw'), dict):
        keys = list(first['raw'].keys())
        if any(_INSTRUCTION_COL.match(str(k)) for k in keys) and any(_RESPONSE_COL.match(str(k)) for k in keys):
            return 'instruction'
    if raw_format in ('csv', 'excel') and isinstance(first.get('raw'), dict):
        keys = list(first['raw'].keys())
        if any(_INSTRUCTION_COL.match(str(k)) for k in keys) and any(_RESPONSE_COL.match(str(k)) for k in keys):
            return 'instruction'
    sample = ' '.join(r.get('text', '') for r in rows[:30])
    if _USER_ANCHOR.search(sample) and _ASSIST_ANCHOR.search(sample): return 'chat_log'
    return 'unstructured_prose'

# ─────────────────────────────────────────────────────────────────────────────
# Layer 3: Cleaning Pipeline (STRICTLY UPGRADED)
# ─────────────────────────────────────────────────────────────────────────────
def clean_dataset(
    rows: list[dict],
    dedup_threshold: float = 0.85,
    min_length: int = 20,
    max_length_multiplier: float = 4.0,
) -> tuple[list[dict], list[dict]]:
    
    clean: list[dict] = []
    quarantine: list[dict] = []

    # ── Step 1: PII, structural checks, and anomalies ──
    for i, row in enumerate(rows):
        text = row.get('text', '')
        raw = row.get('raw')

        # Clean corrupted unicode and null bytes
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text).strip()
        text = text.replace('â€™', "'").replace('â€œ', '"').replace('â€', '"') 

        # 1a. Extremely short columns in structured formats (e.g. "a,b")
        too_short_col = False
        if isinstance(raw, dict):
            for k, v in raw.items():
                v_str = str(v).strip()
                # Reject if column data is less than 3 chars (unless it's just a number)
                if v_str and len(v_str) < 3 and not v_str.isnumeric():
                    too_short_col = True
                    break
                    
        if len(text) < min_length or too_short_col:
            row['_source_row'] = row.get('_source_row', i + 1)
            quarantine.append({**row, 'text': text, 'rejection_reason': 'too_short_or_malformed'})
            continue

        # 1b. Excessive Symbol Ratio (catches "askdjfhasdkjf !!@@##")
        if len(text) > 0:
            alnum_ratio = sum(c.isalnum() or c.isspace() for c in text) / len(text)
            if alnum_ratio < 0.6:  # Less than 60% standard characters
                row['_source_row'] = row.get('_source_row', i + 1)
                quarantine.append({**row, 'text': text, 'rejection_reason': 'excessive_symbols'})
                continue

        # 1c. Word Repetition (catches "word word word word...")
        words = text.split()
        if len(words) > 15:
            unique_words = set(w.lower() for w in words)
            if len(unique_words) / len(words) < 0.25: # Less than 25% unique vocabulary
                row['_source_row'] = row.get('_source_row', i + 1)
                quarantine.append({**row, 'text': text, 'rejection_reason': 'excessive_word_repetition'})
                continue

        # 1d. Gibberish Word Check 
        if any(len(w) > 25 and not any(v in w.lower() for v in 'aeiouy') for w in words):
            row['_source_row'] = row.get('_source_row', i + 1)
            quarantine.append({**row, 'text': text, 'rejection_reason': 'possible_gibberish_word'})
            continue

        # Pre-flag for Code/SQL injection
        row['_is_code'] = _is_code_like(text)

        # PII scrub and hash
        text = _scrub_pii(text)
        row['text'] = text
        row['_id'] = _row_id(f"{i}:{text[:200]}")
        row['_source_row'] = row.get('_source_row', i + 1)
        clean.append(row)

    if not clean:
        return [], quarantine

    # ── Step 2: Context-Aware Code/SQL Rejection ──
    # If less than 20% of the dataset is code, treat code rows as unwanted anomalies (SQL Injections)
    code_ratio = sum(1 for r in clean if r.get('_is_code')) / len(clean)
    if code_ratio < 0.20:
        after_code = []
        for r in clean:
            if r.get('_is_code'):
                quarantine.append({**r, 'rejection_reason': 'unexpected_code_or_sql_injection'})
            else:
                after_code.append(r)
        clean = after_code

    if not clean:
        return [], quarantine

    # ── Step 3: Extreme-length filter ──
    lengths = sorted(len(r['text']) for r in clean)
    p95 = lengths[max(0, int(len(lengths) * 0.95) - 1)]
    max_len = max(p95 * max_length_multiplier, 2000)

    after_len: list[dict] = []
    for r in clean:
        if len(r['text']) > max_len:
            quarantine.append({**r, 'rejection_reason': 'too_long'})
        else:
            after_len.append(r)
    clean = after_len

    # ── Step 4: Near-duplicate detection via MinHash LSH ──
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
        logger.warning("datasketch not installed — exact deduplication fallback")
        seen: set[str] = set()
        deduped = []
        for row in clean:
            h = hashlib.md5(row['text'].encode()).hexdigest()
            if h in seen:
                quarantine.append({**row, 'rejection_reason': 'exact_duplicate'})
            else:
                seen.add(h)
                deduped.append(row)
        clean = deduped

    return clean, quarantine

# ─────────────────────────────────────────────────────────────────────────────
# Layer 4: Hybrid Task Formatting
# ─────────────────────────────────────────────────────────────────────────────
def _heuristic_qa_from_chunk(chunk: str) -> list[dict]:
    pairs = []
    if _is_code_like(chunk):
        lang = 'SQL' if 'SELECT' in chunk.upper() else 'Code'
        pairs.append({'instruction': f"Explain this {lang}: {chunk[:80].strip()}", 'response': chunk.strip()})
        return pairs

    heading_re = re.compile(r'^#+\s+(.+)$', re.MULTILINE)
    headings = heading_re.findall(chunk)
    if headings:
        for h in headings[:3]: pairs.append({'instruction': f"What does the document say about '{h}'?", 'response': chunk[:600].strip()})
        return pairs

    sentences = re.split(r'(?<=[.!?])\s+', chunk.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 40]
    for sent in sentences[:3]:
        m = re.match(r'^(.{5,50}?)\s+(?:is|are|was|were|can|will|should)\s+', sent)
        if m: pairs.append({'instruction': f"What is {m.group(1).strip().rstrip(',')}?", 'response': sent})
        else: pairs.append({'instruction': f"Explain: {sent[:80].rstrip('.')}.", 'response': sent})

    if not pairs:
        pairs.append({'instruction': f"Summarize: {chunk[:100]}...", 'response': chunk[:500]})
    return pairs

def format_rows(
    rows: list[dict],
    schema_type: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[dict]:
    output: list[dict] = []
    if schema_type == 'jsonl_messages':
        for row in rows:
            if 'messages' in row: output.append({'messages': row['messages'], '_id': row.get('_id', ''), '_source_row': row.get('_source_row', '')})
    elif schema_type == 'instruction':
        for row in rows:
            raw = row.get('raw', {})
            if not isinstance(raw, dict): continue
            instruction = next((str(v) for k, v in raw.items() if _INSTRUCTION_COL.match(str(k))), '')
            response    = next((str(v) for k, v in raw.items() if _RESPONSE_COL.match(str(k))),    '')
            if instruction and response:
                output.append({'messages': [{'role': 'user', 'content': instruction}, {'role': 'assistant', 'content': response}], '_id': row.get('_id', ''), '_source_row': row.get('_source_row', '')})
    elif schema_type == 'chat_log':
        for row in rows:
            text = row.get('text', '')
            roles_r = re.findall(r'(?i)\[(user|human|assistant|ai|bot)\]\s*:', text)
            segments = re.split(r'(?i)\[(user|human|assistant|ai|bot)\]\s*:', text)
            messages = []
            for role_raw, content in zip(roles_r, segments[1:]):
                role = 'user' if role_raw.lower() in ('user', 'human') else 'assistant'
                if content.strip(): messages.append({'role': role, 'content': content.strip()})
            if len(messages) >= 2: output.append({'messages': messages, '_id': row.get('_id', ''), '_source_row': row.get('_source_row', '')})
    elif schema_type == 'unstructured_prose':
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len)
            split_fn = splitter.split_text
        except ImportError:
            def split_fn(text: str) -> list[str]:
                words = text.split(); chunks = []; step = max(1, chunk_size - chunk_overlap)
                for i in range(0, len(words), step):
                    chunk = ' '.join(words[i: i + chunk_size])
                    if chunk: chunks.append(chunk)
                return chunks
        for row in rows:
            for chunk in split_fn(row.get('text', '')):
                chunk = chunk.strip()
                if len(chunk) < 50: continue
                for qa in _heuristic_qa_from_chunk(chunk):
                    output.append({'messages': [{'role': 'user', 'content': qa['instruction']}, {'role': 'assistant', 'content': qa['response']}], '_id': _row_id(chunk[:100]), '_source_row': row.get('_source_row', '')})
    return output

# ─────────────────────────────────────────────────────────────────────────────
# Layer 5 helpers: JSONL I/O + download
# ─────────────────────────────────────────────────────────────────────────────
def write_jsonl(pairs: list[dict], path: str) -> int:
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
    count = 0
    with open(path, 'w', encoding='utf-8') as f:
        for pair in pairs:
            f.write(json.dumps({'messages': pair['messages']}, ensure_ascii=False, default=str) + '\n')
            count += 1
    return count

def write_quarantine(rows: list[dict], path: str) -> None:
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        for row in rows: f.write(json.dumps(row, ensure_ascii=False, default=str) + '\n')

def pairs_to_jsonl_bytes(pairs: list[dict]) -> bytes:
    return '\n'.join(json.dumps({'messages': pair['messages']}, ensure_ascii=False, default=str) for pair in pairs).encode('utf-8')

def pairs_to_base64_jsonl(pairs: list[dict]) -> str:
    return f"data:application/jsonl;base64,{base64.b64encode(pairs_to_jsonl_bytes(pairs)).decode('ascii')}"

# ─────────────────────────────────────────────────────────────────────────────
# Layer 6: Dynamic LoRA Config
# ─────────────────────────────────────────────────────────────────────────────
def generate_lora_config(row_count: int) -> dict:
    if row_count < 1_000:
        return {'r': 4, 'lora_alpha': 8, 'target_modules': ['q_proj', 'v_proj'], 'lora_dropout': 0.05, 'bias': 'none', 'task_type': 'CAUSAL_LM', 'recommendation': 'Small dataset — low rank prevents overfitting.'}
    elif row_count <= 10_000:
        return {'r': 8, 'lora_alpha': 16, 'target_modules': ['q_proj', 'v_proj', 'k_proj', 'o_proj'], 'lora_dropout': 0.05, 'bias': 'none', 'task_type': 'CAUSAL_LM', 'recommendation': 'Medium dataset — balanced rank for good generalisation.'}
    else:
        return {'r': 16, 'lora_alpha': 32, 'target_modules': ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'], 'lora_dropout': 0.05, 'bias': 'none', 'task_type': 'CAUSAL_LM', 'recommendation': 'Large dataset — high rank with all linear layers for complex domain features.'}

# ─────────────────────────────────────────────────────────────────────────────
# Main Pipeline Entry-point
# ─────────────────────────────────────────────────────────────────────────────
def run_pipeline(
    file_path: str, original_filename: str, output_path: str, quarantine_path: str,
    dedup_threshold: float = 0.85, chunk_size: int = 500, chunk_overlap: int = 50,
    min_length: int = 20, max_length_multiplier: float = 4.0,
) -> dict:
    logs: list[str] = []
    def log(msg: str) -> None:
        logs.append(msg)
        logger.info(msg)

    log(f"Layer 1 · Ingesting {original_filename}…")
    rows, raw_fmt = ingest_file(file_path, original_filename)
    
    log("Layer 2 · Detecting schema…")
    schema = detect_schema(rows, raw_fmt)

    log("Layer 3 · Cleaning…")
    clean, quarantine = clean_dataset(rows, dedup_threshold, min_length, max_length_multiplier)
    dup_count = sum(1 for r in quarantine if r.get('rejection_reason') in ('near_duplicate', 'exact_duplicate'))
    log(f"  → kept {len(clean)}, quarantined {len(quarantine)} (dups: {dup_count})")

    log("Layer 4 · Formatting into training pairs…")
    pairs = format_rows(clean, schema, chunk_size, chunk_overlap)

    log("Layer 5 · Writing JSONL files…")
    row_count = write_jsonl(pairs, output_path)
    write_quarantine(quarantine, quarantine_path)

    log("Layer 6 · Computing LoRA config…")
    lora = generate_lora_config(row_count)

    # REPLACED _id WITH ROW NUMBER IN PREVIEWS AS REQUESTED
    sample_idx = random.sample(range(len(pairs)), min(5, len(pairs)))
    previews = [
        {
            'id': str(pairs[i].get('_source_row', i + 1)), 
            'messages': pairs[i].get('messages', []),
        }
        for i in sample_idx
    ]

    quarantine_ui = [
        {
            '_source_row': r.get('_source_row', '?'),
            '_id': r.get('_id', ''),
            'text': r.get('text', ''),
            'rejection_reason': r.get('rejection_reason', 'unknown'),
        }
        for r in quarantine
    ]

    return {
        'schema_type': schema, 'total_rows_raw': len(rows), 'total_rows_clean': row_count,
        'rows_removed': len(quarantine), 'duplicate_count': dup_count, 'lora_config': lora,
        'preview_samples': previews, 'quarantine': quarantine_ui, 'download_uri': pairs_to_base64_jsonl(pairs),
        'logs': logs,
    }