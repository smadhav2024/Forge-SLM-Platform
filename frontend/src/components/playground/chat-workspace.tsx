"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageList } from "@/components/playground/message-list";
import { ChatInput } from "@/components/playground/chat-input";
import { ModelSelector } from "@/components/playground/model-selector";
import { PlaygroundEmptyState } from "@/components/playground/playground-empty-state";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { useChat } from "@/lib/hooks/use-chat";
import { useModels } from "@/lib/hooks/use-models";

const SELECTED_MODEL_KEY = "forge_selected_model_id";

export function ChatWorkspace() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { data: models } = useModels();

  useEffect(() => {
    const param = searchParams.get("conversation");
    const parsed = param ? Number(param) : null;
    if (parsed && parsed !== conversationId) setConversationId(parsed);
  }, [searchParams]);

  useEffect(() => {
    if (!models || models.length === 0) return;
    if (modelId !== null) return;

    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (saved && models.some((m) => String(m.id) === saved)) {
      setModelId(saved);
      return;
    }

    const llamaModel = models.find(
      (m) => m.is_base_model && m.base_model_key?.toLowerCase().includes("llama"),
    );
    const def = llamaModel ?? models.find((m) => m.is_base_model);
    if (def) setModelId(String(def.id));
  }, [models]);

  const handleModelChange = (id: string | null) => {
    setModelId(id);
    if (id) localStorage.setItem(SELECTED_MODEL_KEY, id);
    else localStorage.removeItem(SELECTED_MODEL_KEY);
  };

  const {
    config,
    ragConfig,
    pendingFiles,
    onFileSelected,
    registerRagHandlers,
    setUploadedFileNames,
    setHasUploadedDocs,
    clearPendingFiles,
  } = useChatConfig();

  const queryClient = useQueryClient();

  const handleDocumentsLoaded = useCallback(
    (filenames: string[], hasDocuments: boolean) => {
      setUploadedFileNames(filenames);
      setHasUploadedDocs(hasDocuments);
    },
    [setUploadedFileNames, setHasUploadedDocs],
  );

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    uploadFile,
    clearDocuments,
  } = useChat({
    modelId,
    conversationId,
    config,
    ragConfig,
    onConversationReady: (id) => {
      setConversationId(id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onDocumentsLoaded: handleDocumentsLoaded,
  });

  // Register upload/clear handlers with context whenever conversationId changes
  useEffect(() => {
    if (!conversationId) {
      registerRagHandlers(null);
      return;
    }

    registerRagHandlers({
      uploadFile: async (file: File, chunkSize: number, chunkOverlap: number) => {
        await uploadFile(conversationId, file, chunkSize, chunkOverlap);
        const res = await fetch(`/api/conversations/${conversationId}/documents`);
        if (res.ok) {
          const data = await res.json();
          setUploadedFileNames(data.filenames ?? []);
          setHasUploadedDocs(data.has_documents ?? false);
        }
      },
      clearDocuments: async () => {
        await clearDocuments(conversationId);
      },
    });

    return () => registerRagHandlers(null);
  }, [conversationId, uploadFile, clearDocuments, registerRagHandlers, setUploadedFileNames, setHasUploadedDocs]);

  const handleSend = useCallback(
    (text: string) => {
      // Clear queued files immediately so they aren't re-sent on next message
      clearPendingFiles();
      sendMessage(text, pendingFiles);
    },
    [sendMessage, pendingFiles, clearPendingFiles],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">Model</span>
        <ModelSelector value={modelId || ""} onChange={handleModelChange} />
      </div>

      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <PlaygroundEmptyState />
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </ScrollArea>

      <div className="border-t px-4 py-3">
        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          onFileDropped={onFileSelected}
          isStreaming={isStreaming}
          isDisabled={!modelId}
        />
      </div>
    </div>
  );
}