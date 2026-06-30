/**
 * Mirrors the relevant subset of ChatCompletionRequest from openapi.json.
 * Defaults match the backend schema's declared defaults exactly.
 */
export interface ChatConfig {
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  /** Whether to use SSE streaming mode. Matches the backend `stream` field. */
  stream?: boolean;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  systemPrompt: "",
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 512,
  stream: true,
};

export const CHAT_CONFIG_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  topP: { min: 0, max: 1, step: 0.05 },
  maxTokens: { min: 1, max: 4096, step: 1 },
} as const;

// ── RAG configuration ────────────────────────────────────────────────────────

/**
 * RAG parameters split into two groups:
 *
 * INGESTION (chunkSize, chunkOverlap) — sent at upload time, locked once
 * documents exist for a conversation. Changing them requires clearing docs first.
 *
 * RETRIEVAL (topK, similarityThreshold, contextBudget) — applied at query time,
 * can be tuned live without re-uploading.
 */
export interface RagConfig {
  // Ingestion
  chunkSize: number;
  chunkOverlap: number;
  // Retrieval
  topK: number;
  similarityThreshold: number;
  contextBudget: number;
}

export const DEFAULT_RAG_CONFIG: RagConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 3,
  similarityThreshold: 0.0,
  contextBudget: 1500,
};

export const RAG_CONFIG_LIMITS = {
  chunkSize:           { min: 100,  max: 2000, step: 50   },
  chunkOverlap:        { min: 0,    max: 500,  step: 25   },
  topK:                { min: 1,    max: 10,   step: 1    },
  similarityThreshold: { min: 0,    max: 1,    step: 0.05 },
  contextBudget:       { min: 200,  max: 4000, step: 100  },
} as const;

export const RAG_STORAGE_KEY = "forge_rag_config";
