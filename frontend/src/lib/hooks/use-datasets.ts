"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineInfo {
  pipeline_status: "PROCESSING" | "REVIEW" | "COMPLETED" | "FAILED";
  schema_type: string | null;
  total_rows_raw: number | null;
  total_rows_clean: number | null;
  rows_removed: number | null;
  duplicate_count: number | null;
  dedup_threshold: number | null;
  chunk_size: number | null;
  chunk_overlap: number | null;
}

export interface DatasetSummary {
  id: number;
  filename: string;
  file_path: string;
  row_count: number;
  uploaded_at: string;
  pipeline: PipelineInfo | null;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PreviewPair {
  _id: string;
  messages: ChatMessage[];
}

export interface LoraConfig {
  r: number;
  lora_alpha: number;
  target_modules: string[];
  lora_dropout: number;
  bias: string;
  task_type: string;
  recommendation: string;
}

export interface DatasetSummaryDetail {
  id: number;
  filename: string;
  pipeline_status: PipelineInfo["pipeline_status"];
  schema_type: string | null;
  total_rows_raw: number;
  total_rows_clean: number;
  rows_removed: number;
  duplicate_count: number;
  dedup_threshold: number;
  chunk_size: number;
  chunk_overlap: number;
  lora_config: LoraConfig | null;
  pipeline_logs: string[];
  preview_samples: PreviewPair[];
  row_count: number;
}

export interface QuarantineRow {
  _id: string;
  text?: string;
  messages?: ChatMessage[];
  rejection_reason: "too_short" | "too_long" | "possible_gibberish" | "near_duplicate";
  [key: string]: unknown;
}

export interface QuarantinePage {
  items: QuarantineRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProcessPayload {
  file: File;
  filename: string;
  dedup_threshold?: number;
  chunk_size?: number;
  chunk_overlap?: number;
}

export interface ReprocessPayload {
  dedup_threshold?: number;
  remove_duplicates?: boolean;
  remove_short?: boolean;
  chunk_size?: number;
  chunk_overlap?: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const datasetsQueryKey = ["datasets"] as const;
export const datasetSummaryKey = (id: number) => ["dataset", id, "summary"] as const;
export const quarantineKey = (id: number, page: number) =>
  ["dataset", id, "quarantine", page] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** List all datasets for current user */
export function useDatasets() {
  return useQuery({
    queryKey: datasetsQueryKey,
    queryFn: () => apiClient<DatasetSummary[]>("/api/datasets"),
  });
}

/** Full pipeline summary for a single dataset */
export function useDatasetSummary(id: number | null) {
  return useQuery({
    queryKey: datasetSummaryKey(id!),
    queryFn: () => apiClient<DatasetSummaryDetail>(`/api/datasets/${id}/summary`),
    enabled: id != null,
    staleTime: 10_000,
  });
}

/** Paginated quarantine rows */
export function useQuarantine(id: number | null, page = 1) {
  return useQuery({
    queryKey: quarantineKey(id!, page),
    queryFn: () =>
      apiClient<QuarantinePage>(
        `/api/datasets/${id}/quarantine?page=${page}&page_size=15`
      ),
    enabled: id != null,
  });
}

/** Upload any file format → runs 6-layer pipeline */
export function useProcessDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      filename,
      dedup_threshold = 0.85,
      chunk_size = 500,
      chunk_overlap = 50,
    }: ProcessPayload) => {
      const form = new FormData();
      form.append("file", file);
      form.append("filename", filename);
      form.append("dedup_threshold", String(dedup_threshold));
      form.append("chunk_size", String(chunk_size));
      form.append("chunk_overlap", String(chunk_overlap));
      return fetch("/api/datasets/process", { method: "POST", body: form }).then(
        async (res) => {
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message ?? "Processing failed");
          }
          return res.json() as Promise<DatasetSummaryDetail>;
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetsQueryKey });
    },
  });
}

/** Legacy direct JSONL import (no pipeline) */
export function useUploadDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, filename }: { file: File; filename: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("filename", filename);
      return fetch("/api/datasets", { method: "POST", body: form }).then(
        async (res) => {
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message ?? "Upload failed");
          }
          return res.json();
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetsQueryKey });
    },
  });
}

/** Restore quarantined rows back into main dataset */
export function useRestoreRows(datasetId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowIds: string[]) =>
      fetch(`/api/datasets/${datasetId}/restore`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row_ids: rowIds }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message ?? "Restore failed");
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetSummaryKey(datasetId) });
      queryClient.invalidateQueries({ queryKey: ["dataset", datasetId, "quarantine"] });
      queryClient.invalidateQueries({ queryKey: datasetsQueryKey });
    },
  });
}

/** Re-run layers 3 & 4 with updated params */
export function useReprocess(datasetId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReprocessPayload) =>
      fetch(`/api/datasets/${datasetId}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message ?? "Reprocess failed");
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetSummaryKey(datasetId) });
      queryClient.invalidateQueries({ queryKey: datasetsQueryKey });
    },
  });
}

/** Inline-edit a Q&A pair */
export function useEditPair(datasetId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      pair_id: string;
      user_message: string;
      assistant_message: string;
    }) =>
      fetch(`/api/datasets/${datasetId}/edit-pair`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message ?? "Edit failed");
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetSummaryKey(datasetId) });
    },
  });
}

/** Delete dataset + all files */
export function useDeleteDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/datasets/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? "Delete failed");
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetsQueryKey });
    },
  });
}
