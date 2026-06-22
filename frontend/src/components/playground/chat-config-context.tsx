"use client";

import { createContext, useContext, useState } from "react";
import { ChatConfig, DEFAULT_CHAT_CONFIG } from "@/lib/chat-config";

interface ChatConfigContextValue {
  config: ChatConfig;
  setConfig: (config: ChatConfig) => void;
  updateConfig: (patch: Partial<ChatConfig>) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ChatConfigContext = createContext<ChatConfigContextValue | null>(null);

export function ChatConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const updateConfig = (patch: Partial<ChatConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <ChatConfigContext.Provider
      value={{ config, setConfig, updateConfig, isSidebarOpen, setSidebarOpen }}
    >
      {children}
    </ChatConfigContext.Provider>
  );
}

export function useChatConfig() {
  const ctx = useContext(ChatConfigContext);
  if (!ctx) {
    throw new Error("useChatConfig must be used within a ChatConfigProvider");
  }
  return ctx;
}
