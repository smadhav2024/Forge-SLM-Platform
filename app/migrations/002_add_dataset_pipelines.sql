-- Migration: 002_add_dataset_pipelines
-- Run AFTER 001_initial (datasets table must exist)

CREATE TABLE IF NOT EXISTS dataset_pipelines (
    id               SERIAL PRIMARY KEY,
    dataset_id       INTEGER NOT NULL UNIQUE
                         REFERENCES datasets(id) ON DELETE CASCADE,

    -- lifecycle
    pipeline_status  VARCHAR(32)  NOT NULL DEFAULT 'PROCESSING',
    error_message    TEXT,
    pipeline_logs    TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- file paths
    raw_file_path        TEXT,
    output_file_path     TEXT,
    quarantine_file_path TEXT,

    -- layer outputs
    schema_type      VARCHAR(64),
    total_rows_raw   INTEGER,
    total_rows_clean INTEGER,
    rows_removed     INTEGER,
    duplicate_count  INTEGER,

    -- processing params (stored for /reprocess replay)
    dedup_threshold  FLOAT   DEFAULT 0.85,
    chunk_size       INTEGER DEFAULT 500,
    chunk_overlap    INTEGER DEFAULT 50,

    -- layer 6 lora config (JSON string)
    lora_config TEXT
);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION update_dataset_pipelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dataset_pipelines_updated_at ON dataset_pipelines;
CREATE TRIGGER trg_dataset_pipelines_updated_at
    BEFORE UPDATE ON dataset_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_dataset_pipelines_updated_at();

-- Index for the most common lookup
CREATE INDEX IF NOT EXISTS idx_dataset_pipelines_dataset_id
    ON dataset_pipelines(dataset_id);
