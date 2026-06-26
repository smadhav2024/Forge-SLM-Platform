"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, FileText, AlertCircle, ChevronDown, ChevronUp, Loader2, Info,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProcessDataset, useUploadDataset, type DatasetSummaryDetail } from "@/lib/hooks/use-datasets";

const ACCEPTED     = ".jsonl,.csv,.xlsx,.xls,.pdf,.txt,.docx,.doc,.json";
const ACCEPTED_SET = new Set([
  ".jsonl", ".csv", ".xlsx", ".xls", ".pdf", ".txt", ".docx", ".doc", ".json",
]);

const FILE_FORMAT_TIPS: Record<string, string> = {
  ".jsonl": "ChatML or instruction/response pairs — imported directly, no pipeline needed.",
  ".csv":   "Spreadsheet rows. If columns are named 'instruction'/'response' (or similar), pairs are extracted automatically. Otherwise each row is serialized as text.",
  ".xlsx":  "Same as CSV but Excel format.",
  ".pdf":   "Pages are extracted as plain text and chunked into Q&A pairs using the 6-layer pipeline.",
  ".txt":   "Plain text. Paragraphs are split, chunked, and converted to Q&A pairs.",
  ".docx":  "Word document. Paragraphs are extracted, chunked, and converted to Q&A pairs.",
  ".json":  "JSON array or object. Each item is treated as a row and processed through the pipeline.",
};

const SLIDER_TIPS = {
  dedup: `Controls how similar two rows must be to be flagged as duplicates.
• 0.50 = very aggressive — removes loosely similar rows
• 0.85 = balanced (default) — only near-identical rows removed
• 1.00 = disabled — keep all rows regardless of similarity
Increase if you want to keep more data; decrease to strip repetition.`,

  chunkSize: `For unstructured text (PDFs, articles, plain text), this is how many characters each piece is split into before Q&A pairs are generated.
• Smaller (100–300) = more pairs, each narrow in scope
• Larger (500–2000) = fewer pairs, each richer in context
Has no effect on structured CSV / JSONL datasets.`,

  chunkOverlap: `How many characters are shared between consecutive chunks to preserve context at boundaries.
• 0 = no overlap — fully independent chunks
• 50 = light (default) — smooth context handoff
• 200 = heavy — more redundancy, fewer gaps
Only applies when processing unstructured text.`,
};

function InfoTip({ tip }: { tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[230px] text-xs leading-relaxed whitespace-pre-line">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getExt(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SCHEMA_LABELS: Record<string, string> = {
  jsonl_messages:     "ChatML",
  instruction:        "Instruction / Response",
  chat_log:           "Chat Log",
  unstructured_prose: "Prose → Q&A synthesis",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPipelineComplete?: (result: DatasetSummaryDetail) => void;
}

export function UploadDatasetDialog({ open, onOpenChange, onPipelineComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile]         = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pipeline params
  const [dedupThreshold, setDedupThreshold] = useState(0.85);
  const [chunkSize, setChunkSize]           = useState(500);
  const [chunkOverlap, setChunkOverlap]     = useState(50);

  const process = useProcessDataset();
  const upload  = useUploadDataset();

  const isJsonl   = file ? getExt(file.name) === ".jsonl" : false;
  const isPending = process.isPending || upload.isPending;
  const fileExt   = file ? getExt(file.name) : null;

  const validateAndSet = (f: File) => {
    setError(null);
    if (!ACCEPTED_SET.has(getExt(f.name))) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED}`);
      return;
    }
    setFile(f);
    if (!filename) setFilename(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = () => {
    if (!file || !filename.trim()) return;
    setError(null);

    if (isJsonl) {
      upload.mutate(
        { file, filename: filename.trim() },
        {
          onSuccess: () => {
            toast.success(`"${filename}" imported directly.`);
            handleClose(false);
          },
          onError: (err) => setError(err.message),
        }
      );
    } else {
      process.mutate(
        {
          file,
          filename: filename.trim(),
          dedup_threshold: dedupThreshold,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        },
        {
          onSuccess: (result) => {
            toast.success(`"${filename}" processed — ${result.total_rows_clean} training pairs ready.`);
            onPipelineComplete?.(result);
            handleClose(false);
          },
          onError: (err) => setError(err.message),
        }
      );
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setFile(null);
      setFilename("");
      setError(null);
      setShowAdvanced(false);
      setDedupThreshold(0.85);
      setChunkSize(500);
      setChunkOverlap(50);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload dataset</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-name">Dataset name</Label>
            <Input
              id="ds-name"
              placeholder="e.g. hr-finetune-v1"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>

          {/* Drop zone */}
          <div
            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-violet-500 hover:bg-violet-500/5"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) validateAndSet(f);
            }}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-violet-400" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                {fileExt && FILE_FORMAT_TIPS[fileExt] && (
                  <p className="text-center text-[11px] text-muted-foreground max-w-[280px] leading-relaxed">
                    {FILE_FORMAT_TIPS[fileExt]}
                  </p>
                )}
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">
                  Drop file here or click to browse
                </span>
                <div className="flex flex-wrap justify-center gap-1">
                  {[".jsonl", ".csv", ".pdf", ".docx", ".txt", ".json", ".xlsx"].map((ext) => (
                    <TooltipProvider key={ext} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help text-xs font-mono">
                            {ext}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px] text-xs">
                          {FILE_FORMAT_TIPS[ext] ?? ext}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground text-center max-w-[280px]">
                  Hover any format badge to learn how it's processed
                </p>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validateAndSet(f);
              e.target.value = "";
            }}
          />

          {/* Mode badge */}
          {file && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {isJsonl ? (
                <span>⚡ <strong>Direct import</strong> — JSONL skips the pipeline</span>
              ) : (
                <span>🔬 <strong>6-layer pipeline</strong> — cleans, deduplicates, removes junk/SQL, scrubs PII, and formats pairs</span>
              )}
            </div>
          )}

          {/* Advanced pipeline params (hidden for JSONL) */}
          {!isJsonl && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Pipeline settings
              </button>

              {showAdvanced && (
                <div className="mt-3 flex flex-col gap-4 rounded-md border bg-muted/30 p-4">
                  {/* Dedup threshold */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Dedup threshold</Label>
                        <InfoTip tip={SLIDER_TIPS.dedup} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {dedupThreshold.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      min={0.5} max={1.0} step={0.01}
                      value={[dedupThreshold]}
                      onValueChange={([v]) => setDedupThreshold(v)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {dedupThreshold >= 0.95
                        ? "Very lenient — almost no deduplication"
                        : dedupThreshold >= 0.85
                        ? "Balanced — removes near-identical rows (recommended)"
                        : dedupThreshold >= 0.70
                        ? "Aggressive — removes loosely similar rows"
                        : "Very aggressive — may remove valid similar content"}
                    </p>
                  </div>

                  {/* Chunk size */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Chunk size (chars)</Label>
                        <InfoTip tip={SLIDER_TIPS.chunkSize} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{chunkSize}</span>
                    </div>
                    <Slider
                      min={100} max={2000} step={50}
                      value={[chunkSize]}
                      onValueChange={([v]) => setChunkSize(v)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {chunkSize <= 200
                        ? "Short chunks → more pairs, narrow scope"
                        : chunkSize <= 600
                        ? "Medium chunks → balanced (recommended for most docs)"
                        : "Long chunks → fewer pairs, richer context per pair"}
                    </p>
                  </div>

                  {/* Chunk overlap */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Chunk overlap (chars)</Label>
                        <InfoTip tip={SLIDER_TIPS.chunkOverlap} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{chunkOverlap}</span>
                    </div>
                    <Slider
                      min={0} max={200} step={10}
                      value={[chunkOverlap]}
                      onValueChange={([v]) => setChunkOverlap(v)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {chunkOverlap === 0
                        ? "No overlap — fully independent chunks"
                        : chunkOverlap <= 60
                        ? "Light overlap — smooth context handoff (recommended)"
                        : "Heavy overlap — more redundancy, fewer context gaps"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !filename.trim() || isPending}
          >
            {isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
            ) : isJsonl ? (
              "Import"
            ) : (
              "Process & Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}