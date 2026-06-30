"use client";

import { useRef, useState, useEffect } from "react";
import {
  PanelRightClose,
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Database,
  Search,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { CHAT_CONFIG_LIMITS, RAG_CONFIG_LIMITS } from "@/lib/chat-config";
import { cn } from "@/lib/utils";

// ── ParamSlider ────────────────────────────────────────────────────────────────

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayValue: string;
  tooltip: {
    what: string;
    low: string;
    high: string;
  };
  disabled?: boolean;
  minLabel?: string;
  maxLabel?: string;
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
  tooltip,
  disabled = false,
  minLabel,
  maxLabel,
}: ParamSliderProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", disabled && "pointer-events-none opacity-40")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-xs font-normal text-foreground">{label}</Label>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                className="no-scale cursor-default rounded-sm text-muted-foreground/60 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <HelpCircle className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              align="start"
              className="max-w-[210px] space-y-2 p-3"
            >
              <p className="text-[11px] leading-snug text-popover-foreground">
                {tooltip.what}
              </p>
              <div className="space-y-1 border-t border-border pt-2">
                <p className="text-[10px] leading-snug text-muted-foreground">
                  <span className="font-medium text-popover-foreground">Low — </span>
                  {tooltip.low}
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  <span className="font-medium text-popover-foreground">High — </span>
                  {tooltip.high}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {displayValue}
        </span>
      </div>

      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        className="no-scale"
      />

      <div className="flex justify-between">
        <span className="text-[10px] text-muted-foreground/60">
          {minLabel ?? min}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {maxLabel ?? max}
        </span>
      </div>
    </div>
  );
}

// ── RightSidebar ───────────────────────────────────────────────────────────────

export function RightSidebar() {
  const {
    config,
    updateConfig,
    ragConfig,
    updateRagConfig,
    isSidebarOpen,
    setSidebarOpen,
    uploadedFileNames,
    pendingFiles,
    isUploadingDoc,
    hasUploadedDocs,
    onFileSelected,
    onClearDocuments,
  } = useChatConfig();

  // ── Hydration guard ───────────────────────────────────────────────────────
  // Config is loaded from localStorage on the client; the server renders
  // defaults. We defer rendering config-derived values until after mount to
  // avoid the SSR/client mismatch hydration error.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const { temperature, topP, maxTokens } = CHAT_CONFIG_LIMITS;
  const rag = RAG_CONFIG_LIMITS;
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isSidebarOpen) return null;

  const displayFiles =
    uploadedFileNames.length > 0
      ? uploadedFileNames
      : pendingFiles.map((f) => f.name);

  // Ingestion sliders are locked once documents have been indexed
  const ingestionLocked = hasUploadedDocs || uploadedFileNames.length > 0;

  // Overlap can't exceed chunk_size - 1
  const maxOverlap = Math.min(rag.chunkOverlap.max, ragConfig.chunkSize - 1);

  return (
    <TooltipProvider>
      <aside className="flex h-full w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar p-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Generation settings</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse settings panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        {/* ── System prompt ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="system-prompt">System prompt</Label>
          <Textarea
            id="system-prompt"
            placeholder="You are a helpful assistant..."
            value={config.systemPrompt}
            onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
            className="min-h-24 resize-none"
          />
        </div>

        <Separator />

        {/* ── Temperature ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>{isMounted ? config.temperature.toFixed(1) : "-"}</span>
          </div>
          <Slider
            min={temperature.min}
            max={temperature.max}
            step={temperature.step}
            value={[config.temperature]}
            onValueChange={([v]) => updateConfig({ temperature: v })}
            className="no-scale"
          />
          <p className="text-[11px] text-muted-foreground">
            {isMounted
              ? config.temperature < 0.4
                ? "Focused — more deterministic output"
                : config.temperature < 1.1
                ? "Balanced — mix of creativity and precision"
                : "Creative — higher variance, more exploratory"
              : "Balanced — mix of creativity and precision"}
          </p>
        </div>

        {/* ── Top-P ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Top-P</Label>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>{isMounted ? config.topP.toFixed(2) : "-"}</span>
          </div>
          <Slider
            min={topP.min}
            max={topP.max}
            step={topP.step}
            value={[config.topP]}
            onValueChange={([v]) => updateConfig({ topP: v })}
            className="no-scale"
          />
          <p className="text-[11px] text-muted-foreground">
            Nucleus sampling — lower values constrain token selection to the most likely options.
          </p>
        </div>

        {/* ── Max tokens ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Max tokens</Label>
            <span className="text-xs text-muted-foreground">
              max {isMounted ? maxTokens.max.toLocaleString() : maxTokens.max}
            </span>
          </div>
          <Input
            type="number"
            min={maxTokens.min}
            max={maxTokens.max}
            value={config.maxTokens}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value))
                updateConfig({ maxTokens: Math.min(maxTokens.max, Math.max(maxTokens.min, value)) });
            }}
          />
        </div>

        <Separator />

        {/* ══ RAG SETTINGS ═══════════════════════════════════════════════════ */}

        {/* ── Ingestion sub-section ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Ingestion</span>
            </div>
            {ingestionLocked ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div className="flex cursor-default items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5">
                    <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Locked</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[180px] text-[11px]">
                  Documents are already indexed with these settings. Clear docs to re-configure.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-[10px] text-muted-foreground/60">Set before uploading</span>
            )}
          </div>

          <ParamSlider
            label="Chunk size"
            value={ragConfig.chunkSize}
            min={rag.chunkSize.min}
            max={rag.chunkSize.max}
            step={rag.chunkSize.step}
            onChange={(v) => updateRagConfig({ chunkSize: v })}
            displayValue={`${ragConfig.chunkSize} chars`}
            disabled={ingestionLocked}
            minLabel="100 chars"
            maxLabel="2000 chars"
            tooltip={{
              what: "How many characters each indexed text fragment contains. Smaller chunks enable precise retrieval; larger chunks retain more surrounding context.",
              low: "Short, precise fragments. Best for Q&A on specific facts.",
              high: "Full paragraphs retained. Better for summaries or narrative documents.",
            }}
          />

          <ParamSlider
            label="Chunk overlap"
            value={ragConfig.chunkOverlap}
            min={rag.chunkOverlap.min}
            max={maxOverlap}
            step={rag.chunkOverlap.step}
            onChange={(v) => updateRagConfig({ chunkOverlap: v })}
            displayValue={`${ragConfig.chunkOverlap} chars`}
            disabled={ingestionLocked}
            minLabel="0 (no overlap)"
            maxLabel={`${maxOverlap}`}
            tooltip={{
              what: "How many characters consecutive chunks share. Prevents sentences from being cut mid-thought at chunk boundaries.",
              low: "Minimal overlap. Fewer total chunks; works well with larger chunk sizes.",
              high: "Heavy overlap. Protects against boundary loss but increases total chunk count.",
            }}
          />
        </div>

        {/* ── Retrieval sub-section ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Retrieval</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60">Adjustable anytime</span>
          </div>

          <ParamSlider
            label="Top-K results"
            value={ragConfig.topK}
            min={rag.topK.min}
            max={rag.topK.max}
            step={rag.topK.step}
            onChange={(v) => updateRagConfig({ topK: v })}
            displayValue={`${ragConfig.topK}`}
            minLabel="1"
            maxLabel="10"
            tooltip={{
              what: "How many text chunks are retrieved and injected into the model's context per query.",
              low: "Tight retrieval. Best for specific questions where precision matters most.",
              high: "Broad retrieval. More context for open-ended or multi-part questions.",
            }}
          />

          <ParamSlider
            label="Min. similarity"
            value={ragConfig.similarityThreshold}
            min={rag.similarityThreshold.min}
            max={rag.similarityThreshold.max}
            step={rag.similarityThreshold.step}
            onChange={(v) => updateRagConfig({ similarityThreshold: v })}
            displayValue={
              ragConfig.similarityThreshold === 0
                ? "off"
                : ragConfig.similarityThreshold.toFixed(2)
            }
            minLabel="0 (off)"
            maxLabel="1.00"
            tooltip={{
              what: "Minimum cosine similarity a chunk must reach to be included. 0 disables filtering — all top-K results pass regardless of match quality.",
              low: "Loose filter. Blocks only clearly unrelated chunks.",
              high: "Strict. Only very close matches are injected; may return fewer than top-K.",
            }}
          />

          <ParamSlider
            label="Context budget"
            value={ragConfig.contextBudget}
            min={rag.contextBudget.min}
            max={rag.contextBudget.max}
            step={rag.contextBudget.step}
            onChange={(v) => updateRagConfig({ contextBudget: v })}
            displayValue={`${ragConfig.contextBudget.toLocaleString()} chars`}
            minLabel="200"
            maxLabel="4 000"
            tooltip={{
              what: "Maximum characters of retrieved context injected into the system prompt. Prevents long documents from overwhelming the model's context window.",
              low: "Compact injection. Keeps the prompt short — ideal for smaller models.",
              high: "Full context use. Maximum information, best for capable models with large windows.",
            }}
          />
        </div>

        <Separator />

        {/* ── Context documents ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Context documents</span>
            {hasUploadedDocs && (
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                Active
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Upload PDF, DOCX, or TXT files. The model will use them as context when answering.
          </p>

          {displayFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {displayFiles.map((name, i) => (
                <div
                  key={`${name}-${i}`}
                  className="flex items-center gap-2 rounded-md border bg-secondary/50 px-2.5 py-1.5 text-xs"
                >
                  {isUploadingDoc ? (
                    <Loader2 className="h-3 w-3 animate-spin shrink-0 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  )}
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground">{name}</span>
                </div>
              ))}
            </div>
          )}

          {hasUploadedDocs && uploadedFileNames.length === 0 && pendingFiles.length === 0 && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs",
                "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Documents embedded — RAG is active for this conversation.</span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={isUploadingDoc}
            >
              {isUploadingDoc ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {isUploadingDoc ? "Uploading…" : "Upload file"}
            </Button>

            {(hasUploadedDocs || displayFiles.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={onClearDocuments}
                disabled={isUploadingDoc}
                aria-label="Clear all context documents"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}