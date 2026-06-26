"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  BrainCircuit,
  Sparkles,
  ArrowUp,
  Square,
  RotateCcw,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useModels } from "@/lib/hooks/use-models";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";
import { CHAT_CONFIG_LIMITS, DEFAULT_CHAT_CONFIG } from "@/lib/chat-config";
import type { ChatConfig } from "@/lib/chat-config";
import type { ModelSummary } from "@/types/api";

//  Types  

interface PanelMessage {
  clientId: string;
  role: "user" | "assistant";
  content: string;
}

// Streaming helper  

async function streamChat(
  modelId: string,
  messages: { role: string; content: string }[],
  config: ChatConfig,
  onToken: (token: string) => void,
  signal: AbortSignal,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
      system_prompt: config.systemPrompt || undefined,
      temperature: config.temperature,
      top_p: config.topP,
      max_tokens: config.maxTokens,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (line.startsWith(":")) continue;
      if (line === "") { currentEvent = ""; continue; }
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6).trim();

      if (currentEvent === "error") {
        try {
          const err = JSON.parse(data);
          throw new Error(err.detail ?? err.message ?? data);
        } catch {
          throw new Error(data);
        }
      }

      if (currentEvent !== "message") continue;

      try {
        const chunk = JSON.parse(data);
        const token = chunk.token ?? "";
        if (token) onToken(token);
      } catch {
        // skip malformed chunks
      }
    }
  }
}

//  Model selector (filtered) 

function FilteredModelSelector({
  value,
  onChange,
  models,
  filterType,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  models: ModelSummary[];
  filterType: "base" | "user";
  placeholder: string;
}) {
  const filtered = useMemo(
    () =>
      filterType === "base"
        ? models.filter((m) => m.is_base_model)
        : models.filter(
            (m) =>
              !m.is_base_model &&
              (m.status?.toUpperCase() === "READY" ||
                m.status?.toUpperCase() === "COMPLETED"),
          ),
    [models, filterType],
  );

  const selectedModel = filtered.find((m) => String(m.id) === value);

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={filtered.length === 0}>
      <SelectTrigger
        className={cn(
          "h-9 w-full rounded-xl border-input/60 bg-background/50 backdrop-blur-sm px-3 shadow-sm transition-all",
          "hover:bg-accent/50 hover:border-accent-foreground/20",
          "focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
          !value && "text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedModel &&
            (filterType === "base" ? (
              <BrainCircuit className="h-4 w-4 text-primary/70 shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-500/80 shrink-0" />
            ))}
          <SelectValue placeholder={filtered.length === 0 ? "No models available" : placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl shadow-lg border-muted/50 backdrop-blur-xl bg-background/95">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {filterType === "user" ? "No fine-tuned models ready yet" : "No base models available"}
          </div>
        ) : (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
              {filterType === "base" ? (
                <><BrainCircuit className="h-3.5 w-3.5" /> Base Models</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Your Fine-tuned Models</>
              )}
            </SelectLabel>
            {filtered.map((m) => (
              <SelectItem
                key={m.id}
                value={String(m.id)}
                className="rounded-lg mx-1 my-0.5 cursor-pointer transition-colors focus:bg-accent/80"
              >
                <span className="font-medium">{m.display_name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

//  Message bubble  

function MessageBubble({
  message,
  isLast,
  isStreaming,
}: {
  message: PanelMessage;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const showCursor = isLast && !isUser && isStreaming;

  return (
    <div className={cn("flex gap-2.5 px-3 py-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          isUser ? "bg-brand text-brand-foreground" : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? "U" : "AI"}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
          isUser
            ? "bg-brand text-brand-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
        {showCursor && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" />
        )}
      </div>
    </div>
  );
}

//  Chat panel 

function ChatPanel({
  label,
  icon: Icon,
  iconClass,
  modelId,
  onModelChange,
  models,
  filterType,
  placeholder,
  messages,
  isStreaming,
  onStop,
}: {
  label: string;
  icon: React.ElementType;
  iconClass: string;
  modelId: string;
  onModelChange: (v: string) => void;
  models: ModelSummary[];
  filterType: "base" | "user";
  placeholder: string;
  messages: PanelMessage[];
  isStreaming: boolean;
  onStop: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 border rounded-xl overflow-hidden bg-card">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/30 shrink-0">
        <Icon className={cn("h-4 w-4 shrink-0", iconClass)} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
        <div className="flex-1 min-w-0">
          <FilteredModelSelector
            value={modelId}
            onChange={onModelChange}
            models={models}
            filterType={filterType}
            placeholder={placeholder}
          />
        </div>
        {isStreaming && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onStop}>
            <Square className="h-3 w-3 fill-current" />
          </Button>
        )}
      </div>

      {/* Message area */}
      <ScrollArea className="flex-1 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2 text-muted-foreground px-6">
            <Icon className={cn("h-8 w-8 opacity-20", iconClass)} />
            <p className="text-sm">
              {modelId ? "Send a prompt to see the response" : "Select a model to get started"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col py-3">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.clientId}
                message={msg}
                isLast={i === messages.length - 1}
                isStreaming={isStreaming}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

//  Right settings panel 

function SettingsPanel({
  config,
  onUpdate,
  onClose,
}: {
  config: ChatConfig;
  onUpdate: (patch: Partial<ChatConfig>) => void;
  onClose: () => void;
}) {
  const { temperature, topP, maxTokens } = CHAT_CONFIG_LIMITS;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Generation settings</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Collapse settings panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cmp-system-prompt">System prompt</Label>
        <Textarea
          id="cmp-system-prompt"
          placeholder="You are a helpful assistant..."
          value={config.systemPrompt}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          className="min-h-24 resize-none"
        />
        <p className="text-[11px] text-muted-foreground">Applied to both models equally.</p>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-xs text-muted-foreground">{config.temperature.toFixed(1)}</span>
        </div>
        <Slider
          min={temperature.min}
          max={temperature.max}
          step={temperature.step}
          value={[config.temperature]}
          onValueChange={([v]) => onUpdate({ temperature: v })}
        />
        <p className="text-[11px] text-muted-foreground">
          {config.temperature < 0.4
            ? "Focused — more deterministic output"
            : config.temperature < 1.1
            ? "Balanced — mix of creativity and precision"
            : "Creative — higher variance, more exploratory"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Top-P</Label>
          <span className="text-xs text-muted-foreground">{config.topP.toFixed(2)}</span>
        </div>
        <Slider
          min={topP.min}
          max={topP.max}
          step={topP.step}
          value={[config.topP]}
          onValueChange={([v]) => onUpdate({ topP: v })}
        />
        <p className="text-[11px] text-muted-foreground">
          Nucleus sampling — lower values constrain token selection to the most likely options.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Max tokens</Label>
          <span className="text-xs text-muted-foreground">
            max {maxTokens.max.toLocaleString()}
          </span>
        </div>
        <Input
          type="number"
          min={maxTokens.min}
          max={maxTokens.max}
          value={config.maxTokens}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v))
              onUpdate({ maxTokens: Math.min(maxTokens.max, Math.max(maxTokens.min, v)) });
          }}
        />
      </div>
    </aside>
  );
}

//  Main page  

export default function ComparePage() {
  const { data: models = [] } = useModels();

  const [leftModelId, setLeftModelId] = useState("");
  const [rightModelId, setRightModelId] = useState("");

  const [leftMessages, setLeftMessages] = useState<PanelMessage[]>([]);
  const [rightMessages, setRightMessages] = useState<PanelMessage[]>([]);
  const [leftStreaming, setLeftStreaming] = useState(false);
  const [rightStreaming, setRightStreaming] = useState(false);

  const leftAbort = useRef<AbortController | null>(null);
  const rightAbort = useRef<AbortController | null>(null);

  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const updateConfig = (patch: Partial<ChatConfig>) => setConfig((p) => ({ ...p, ...patch }));

  const [settingsOpen, setSettingsOpen] = useState(true);

  // Default model selections
  useEffect(() => {
    if (!models.length) return;
    if (!leftModelId) {
      const base = models.find((m) => m.is_base_model);
      if (base) setLeftModelId(String(base.id));
    }
    if (!rightModelId) {
      const finetuned = models.find(
        (m) =>
          !m.is_base_model &&
          (m.status?.toUpperCase() === "READY" || m.status?.toUpperCase() === "COMPLETED"),
      );
      if (finetuned) setRightModelId(String(finetuned.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const runPanel = useCallback(
    async (
      side: "left" | "right",
      modelId: string,
      historyMessages: PanelMessage[],
      text: string,
    ) => {
      const abortRef = side === "left" ? leftAbort : rightAbort;
      const setMessages = side === "left" ? setLeftMessages : setRightMessages;
      const setStreaming = side === "left" ? setLeftStreaming : setRightStreaming;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Add assistant placeholder
      const placeholderId = crypto.randomUUID();
      setMessages((p) => [...p, { clientId: placeholderId, role: "assistant", content: "" }]);
      setStreaming(true);

      const apiMessages = [
        ...historyMessages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: text },
      ];

      try {
        await streamChat(
          modelId,
          apiMessages,
          config,
          (token) => {
            setMessages((p) => {
              const msgs = [...p];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant") {
                msgs[msgs.length - 1] = { ...last, content: last.content + token };
              }
              return msgs;
            });
          },
          ctrl.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error(`${side === "left" ? "Left" : "Right"} panel: ${(err as Error).message}`);
          setMessages((p) => p.slice(0, -1));
        }
      } finally {
        setStreaming(false);
      }
    },
    [config],
  );

  const handleSend = useCallback(() => {
    const text = prompt.trim();
    if (!text) return;
    if (!leftModelId && !rightModelId) {
      toast.error("Select at least one model to chat with.");
      return;
    }

    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg = (id: string): PanelMessage => ({
      clientId: id,
      role: "user",
      content: text,
    });

    if (leftModelId) {
      const snapshot = leftMessages;
      const msgId = crypto.randomUUID();
      setLeftMessages((p) => [...p, userMsg(msgId)]);
      runPanel("left", leftModelId, snapshot, text);
    }
    if (rightModelId) {
      const snapshot = rightMessages;
      const msgId = crypto.randomUUID();
      setRightMessages((p) => [...p, userMsg(msgId)]);
      runPanel("right", rightModelId, snapshot, text);
    }
  }, [prompt, leftModelId, rightModelId, leftMessages, rightMessages, runPanel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    leftAbort.current?.abort();
    rightAbort.current?.abort();
    setLeftMessages([]);
    setRightMessages([]);
    setLeftStreaming(false);
    setRightStreaming(false);
    setPrompt("");
  };

  const isSending = leftStreaming || rightStreaming;
  const hasMessages = leftMessages.length > 0 || rightMessages.length > 0;

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">Model Compare</h1>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              A/B Test
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {hasMessages && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleClear}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Panels */}
        <div className="flex flex-1 min-h-0 gap-3 p-3 overflow-hidden">
          <div className="flex-1 min-w-0">
            <ChatPanel
              label="Base Model"
              icon={BrainCircuit}
              iconClass="text-primary/70"
              modelId={leftModelId}
              onModelChange={setLeftModelId}
              models={models}
              filterType="base"
              placeholder="Select base model"
              messages={leftMessages}
              isStreaming={leftStreaming}
              onStop={() => leftAbort.current?.abort()}
            />
          </div>
          <div className="flex-1 min-w-0">
            <ChatPanel
              label="Fine-tuned Model"
              icon={Sparkles}
              iconClass="text-amber-500/80"
              modelId={rightModelId}
              onModelChange={setRightModelId}
              models={models}
              filterType="user"
              placeholder="Select fine-tuned model"
              messages={rightMessages}
              isStreaming={rightStreaming}
              onStop={() => rightAbort.current?.abort()}
            />
          </div>
        </div>

        {/* Shared prompt input */}
        <div className="border-t px-4 py-3 shrink-0">
          <div className="rounded-lg border bg-background flex items-end gap-2 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={() => {
                const el = textareaRef.current;
                if (!el) return;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              placeholder="Enter a prompt — sent to both models simultaneously…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-6 placeholder:text-muted-foreground focus:outline-none"
            />
            {isSending ? (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  leftAbort.current?.abort();
                  rightAbort.current?.abort();
                }}
                aria-label="Stop generation"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleSend}
                disabled={!prompt.trim()}
                aria-label="Send to both models"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground text-center">
            Prompt is sent to both panels simultaneously · Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Reopen button — shown when panel is collapsed */}
      {!settingsOpen && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-4 h-8 w-8"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      )}

      {/* Inline right settings panel */}
      {settingsOpen && (
        <SettingsPanel
          config={config}
          onUpdate={updateConfig}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}