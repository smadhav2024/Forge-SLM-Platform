"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { DatasetSummary } from "@/types/api";

export const datasetsQueryKey = ["datasets"] as const;

export function useDatasets() {
  return useQuery({
    queryKey: datasetsQueryKey,
    queryFn: () => apiClient<DatasetSummary[]>("/api/datasets"),
  });
}

export function useUploadDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, filename }: { file: File; filename: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("filename", filename);
      return fetch("/api/datasets", { method: "POST", body: form }).then(
        async (res) => {
            console.log(res.body)
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message ?? "Upload failed");
          }
          return res.json();
        },
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datasetsQueryKey });
    },
  });
}
