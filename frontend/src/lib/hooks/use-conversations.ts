"use client";

import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CreateConversationRequest, ConversationSummary } from "@/types/api";

export const conversationsQueryKey = ["conversations"] as const;

export function useConversations() {
  return useQuery({
    queryKey: conversationsQueryKey,
    queryFn: () => apiClient<ConversationSummary[]>("/api/conversations"),
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateConversationRequest) =>
      apiClient<ConversationSummary>("/api/conversations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });
}