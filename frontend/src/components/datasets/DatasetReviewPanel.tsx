"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, AlertTriangle, RefreshCw, Undo2,
  ChevronLeft, ChevronRight, Loader2, Pencil, X, Check,
} from "lucide-react";
import {
  useDatasetSummary, useQuarantine,
  useRestoreRows, useReprocess, useEditPair,
  type PreviewPair, type QuarantineRow,
} from "@/lib/hooks/use-datasets";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REJECTION_LABELS: Record<string, string> = {
  too_short:        "Too short",
  too_long:         "Too long (OOM risk)",
  possible_gibberish: "Gibberish / low entropy",
  near_duplicate:   "Near-duplicate",
};

const REJECTION_COLORS: Record<string, string> = {
  too_short:         "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  too_long:          "bg-red-500/10 text-red-400 border-red-500/20",
  possible_gibberish:"bg-orange-500/10 text-orange-400 border-orange-500/20",
  near_duplicate:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

function PairCard({
  pair,
  datasetId,
}: {
  pair: PreviewPair;
  datasetId: number;
}) {
  const [editing, setEditing] = useState(false);
  const user = pair.messages.find((m) => m.role === "user")?.content ?? "";
  const assistant = pair.messages.find((m) => m.role === "assistant")?.content ?? "";
  const [userDraft, setUserDraft]           = useState(user);
  const [assistantDraft, setAssistantDraft] = useState(assistant);
  const editPair = useEditPair(datasetId);

  const save = () => {
    editPair.mutate(
      { pair_id: pair._id, user_message: userDraft, assistant_message: assistantDraft },
      {
        onSuccess: () => { toast.success("Pair updated."); setEditing(false); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="rounded-lg border bg-card p-3 text-xs flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{pair._id}</span>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setUserDraft(user); setAssistantDraft(assistant); }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-violet-400">User</Label>
            <Textarea
              value={userDraft}
              onChange={(e) => setUserDraft(e.target.value)}
              className="min-h-[60px] text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-cyan-400">Assistant</Label>
            <Textarea
              value={assistantDraft}
              onChange={(e) => setAssistantDraft(e.target.value)}
              className="min-h-[80px] text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={editPair.isPending}>
              {editPair.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" /> Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <span className="text-[10px] font-medium text-violet-400">User  </span>
            <span className="text-muted-foreground line-clamp-2">{user}</span>
          </div>
          <div>
            <span className="text-[10px] font-medium text-cyan-400">Assistant  </span>
            <span className="text-muted-foreground line-clamp-3">{assistant}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Quarantine Tab ───────────────────────────────────────────────────────────

function QuarantineTab({ datasetId }: { datasetId: number }) {
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, isLoading }   = useQuarantine(datasetId, page);
  const restore               = useRestoreRows(datasetId);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleRestore = () => {
    restore.mutate([...selected], {
      onSuccess: (r) => {
        toast.success(`${r.restored} row(s) restored.`);
        setSelected(new Set());
      },
      onError: (e) => toast.error(e.message),
    });
  };

  if (isLoading) return <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>;
  if (!data?.total) return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-400" />
      No quarantined rows — clean dataset!
    </div>
  );

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{data.total} quarantined rows</span>
        {selected.size > 0 && (
          <Button size="sm" variant="outline" onClick={handleRestore} disabled={restore.isPending}>
            {restore.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
            Restore {selected.size}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {(data.items as QuarantineRow[]).map((row) => {
          const text = row.text ?? row.messages?.map((m) => m.content).join(" ") ?? "";
          const checked = selected.has(row._id);
          return (
            <div
              key={row._id}
              onClick={() => toggle(row._id)}
              className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                checked ? "border-violet-500 bg-violet-500/5" : "border-border hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    REJECTION_COLORS[row.rejection_reason] ?? ""
                  }`}
                >
                  {REJECTION_LABELS[row.rejection_reason] ?? row.rejection_reason}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mt-0.5 shrink-0 accent-violet-500"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-muted-foreground">{text}</p>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button size="icon" variant="ghost" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Reprocess Tab ───────────────────────────────────────────────────────────

function ReprocessTab({ datasetId, initialThreshold, initialChunkSize }: {
  datasetId: number;
  initialThreshold: number;
  initialChunkSize: number;
}) {
  const [threshold, setThreshold]   = useState(initialThreshold);
  const [chunkSize, setChunkSize]   = useState(initialChunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const reprocess = useReprocess(datasetId);

  const run = () => {
    reprocess.mutate(
      { dedup_threshold: threshold, chunk_size: chunkSize, chunk_overlap: chunkOverlap },
      {
        onSuccess: (r) => toast.success(`Reprocessed — ${r.total_rows_clean} pairs.`),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        Adjust thresholds and re-run layers 3 &amp; 4 on the original raw file.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Dedup threshold</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{threshold.toFixed(2)}</span>
        </div>
        <Slider min={0.5} max={1.0} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
        <p className="text-xs text-muted-foreground">Higher = less aggressive deduplication</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Chunk size</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{chunkSize}</span>
        </div>
        <Slider min={100} max={2000} step={50} value={[chunkSize]} onValueChange={([v]) => setChunkSize(v)} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Chunk overlap</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{chunkOverlap}</span>
        </div>
        <Slider min={0} max={200} step={10} value={[chunkOverlap]} onValueChange={([v]) => setChunkOverlap(v)} />
      </div>

      <Button onClick={run} disabled={reprocess.isPending}>
        {reprocess.isPending ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running pipeline…</>
        ) : (
          <><RefreshCw className="h-3.5 w-3.5" /> Run reprocess</>
        )}
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  datasetId: number | null;
  onClose: () => void;
}

const SCHEMA_LABELS: Record<string, string> = {
  jsonl_messages:    "ChatML",
  instruction:       "Instruction / Response",
  chat_log:          "Chat Log",
  unstructured_prose:"Prose → Q&A",
};

export function DatasetReviewPanel({ datasetId, onClose }: Props) {
  const { data, isLoading } = useDatasetSummary(datasetId);

  return (
    <Sheet open={datasetId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle className="text-sm">
            {isLoading ? "Loading…" : (data?.filename ?? "Dataset Review")}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && (
          <Tabs defaultValue="summary" className="flex flex-col gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
              <TabsTrigger value="quarantine" className="flex-1">
                Quarantine
                {(data.rows_removed ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {data.rows_removed}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="reprocess" className="flex-1">Reprocess</TabsTrigger>
            </TabsList>

            {/* ── Summary ─────────────────────────────────────────────── */}
            <TabsContent value="summary" className="flex flex-col gap-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Schema", SCHEMA_LABELS[data.schema_type ?? ""] ?? data.schema_type],
                  ["Raw rows", data.total_rows_raw],
                  ["Clean rows", data.total_rows_clean],
                  ["Removed", data.rows_removed],
                  ["Duplicates", data.duplicate_count],
                  ["Status", data.pipeline_status],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value ?? "—"}</p>
                  </div>
                ))}
              </div>

              {/* LoRA config */}
              {data.lora_config && (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-medium">Recommended LoRA config</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["rank (r)", data.lora_config.r],
                      ["alpha", data.lora_config.lora_alpha],
                      ["dropout", data.lora_config.lora_dropout],
                    ].map(([k, v]) => (
                      <Badge key={String(k)} variant="outline" className="font-mono text-xs">
                        {k}={v}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.lora_config.recommendation}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Targets: {data.lora_config.target_modules.join(", ")}
                  </p>
                </div>
              )}

              {/* Preview samples */}
              {data.preview_samples?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium">Preview samples</p>
                  {data.preview_samples.map((pair) => (
                    <PairCard key={pair._id} pair={pair} datasetId={data.id} />
                  ))}
                </div>
              )}

              {/* Pipeline logs */}
              {data.pipeline_logs?.length > 0 && (
                <details className="rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                    Pipeline logs ({data.pipeline_logs.length})
                  </summary>
                  <div className="max-h-40 overflow-y-auto bg-muted/30 px-3 py-2">
                    {data.pipeline_logs.map((line, i) => (
                      <p key={i} className="font-mono text-[10px] text-muted-foreground">{line}</p>
                    ))}
                  </div>
                </details>
              )}
            </TabsContent>

            {/* ── Quarantine ──────────────────────────────────────────── */}
            <TabsContent value="quarantine">
              <QuarantineTab datasetId={data.id} />
            </TabsContent>

            {/* ── Reprocess ───────────────────────────────────────────── */}
            <TabsContent value="reprocess">
              <ReprocessTab
                datasetId={data.id}
                initialThreshold={data.dedup_threshold ?? 0.85}
                initialChunkSize={data.chunk_size ?? 500}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
