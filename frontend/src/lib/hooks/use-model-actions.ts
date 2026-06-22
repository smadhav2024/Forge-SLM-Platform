"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { modelsQueryKey } from "@/lib/hooks/use-models";
import type { ModelSummary, RegisterModelRequest } from "@/types/api";

export function useRegisterModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterModelRequest) =>
      apiClient<ModelSummary>("/api/models", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelsQueryKey });
    },
  });
}

export function useStartTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modelId,
      datasetPath,
      baseModelKey,
    }: {
      modelId: number;
      datasetPath: string;
      baseModelKey?: string;
    }) =>
      apiClient(`/api/models/${modelId}/train`, {
        method: "POST",
        body: JSON.stringify({
          dataset_path: datasetPath,
          base_model_key: baseModelKey ?? "tinyllama",
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelsQueryKey });
    },
  });
}