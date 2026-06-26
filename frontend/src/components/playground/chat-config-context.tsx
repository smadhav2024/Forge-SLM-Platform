"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ChatConfig, DEFAULT_CHAT_CONFIG } from "@/lib/chat-config";

const CONFIG_STORAGE_KEY = "forge_chat_config";

function loadPersistedConfig(): ChatConfig {
  if (typeof window === "undefined") return DEFAULT_CHAT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CHAT_CONFIG;
    return { ...DEFAULT_CHAT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CHAT_CONFIG;
  }
}

export interface RagHandlers {
  uploadFile: (file: File) => Promise<void>;
  clearDocuments: () => Promise<void>;
}

interface ChatConfigContextValue {
  config: ChatConfig;
  setConfig: (config: ChatConfig) => void;
  updateConfig: (patch: Partial<ChatConfig>) => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // RAG — read by RightSidebar
  uploadedFileNames: string[];    // persisted names fetched from server on conv load
  pendingFiles: File[];           // files queued before a conv exists
  isUploadingDoc: boolean;
  hasUploadedDocs: boolean;
  onFileSelected: (file: File) => void;
  onClearDocuments: () => void;
  // Called by ChatWorkspace to restore filenames after loading a historical conversation
  setUploadedFileNames: (names: string[]) => void;
  setHasUploadedDocs: (v: boolean) => void;

  registerRagHandlers: (handlers: RagHandlers | null) => void;
}

const ChatConfigContext = createContext<ChatConfigContextValue | null>(null);

export function ChatConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<ChatConfig>(loadPersistedConfig);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [hasUploadedDocs, setHasUploadedDocs] = useState(false);

  const ragHandlersRef = useRef<RagHandlers | null>(null);

  // Persist config changes to localStorage
  const setConfig = useCallback((c: ChatConfig) => {
    setConfigState(c);
    try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(c)); } catch {}
  }, []);

  const updateConfig = useCallback((patch: Partial<ChatConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const registerRagHandlers = useCallback((handlers: RagHandlers | null) => {
    ragHandlersRef.current = handlers;
  }, []);

  const onFileSelected = useCallback(async (file: File) => {
    if (ragHandlersRef.current) {
      // Conversation exists — upload immediately
      setPendingFiles((p) => [...p, file]);
      setIsUploadingDoc(true);
      try {
        await ragHandlersRef.current.uploadFile(file);
        setUploadedFileNames((p) => [...p, file.name]);
        setHasUploadedDocs(true);
      } catch {
        toast.error("Document upload failed.");
        setPendingFiles((p) => p.filter((f) => f !== file));
      } finally {
        setIsUploadingDoc(false);
      }
    } else {
      // No conversation yet — queue; ChatWorkspace flushes these on first send
      setPendingFiles((p) => [...p, file]);
    }
  }, []);

  const onClearDocuments = useCallback(async () => {
    try {
      await ragHandlersRef.current?.clearDocuments();
    } catch {
      toast.error("Failed to clear documents.");
    }
    setPendingFiles([]);
    setUploadedFileNames([]);
    setHasUploadedDocs(false);
  }, []);

  return (
    <ChatConfigContext.Provider
      value={{
        config,
        setConfig,
        updateConfig,
        isSidebarOpen,
        setSidebarOpen,
        uploadedFileNames,
        pendingFiles,
        isUploadingDoc,
        hasUploadedDocs,
        onFileSelected,
        onClearDocuments,
        setUploadedFileNames,
        setHasUploadedDocs,
        registerRagHandlers,
      }}
    >
      {children}
    </ChatConfigContext.Provider>
  );
}

export function useChatConfig() {
  const ctx = useContext(ChatConfigContext);
  if (!ctx) throw new Error("useChatConfig must be used within a ChatConfigProvider");
  return ctx;
}