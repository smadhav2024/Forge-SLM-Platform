"use client";

import { useState } from "react";
import { useDatasets, useDeleteDataset, type DatasetSummary } from "@/lib/hooks/use-datasets";
import { UploadDatasetDialog } from "@/components/datasets/upload-dataset-dialog";
import { DatasetReviewPanel } from "@/components/datasets/DatasetReviewPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Database, FileText, X, Loader2,
  ChevronRight, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PROCESSING: { label: "Processing", icon: Clock,         color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  REVIEW:     { label: "Review",     icon: AlertTriangle,  color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  COMPLETED:  { label: "Ready",      icon: CheckCircle2,   color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  FAILED:     { label: "Failed",     icon: AlertTriangle,  color: "bg-red-500/10 text-red-400 border-red-500/20" },
} as const;

function PipelineBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function DatasetRow({
  dataset,
  onReview,
  onDelete,
}: {
  dataset: DatasetSummary;
  onReview: () => void;
  onDelete: () => void;
}) {
  const status   = dataset.pipeline?.pipeline_status;
  const canReview = status && status !== "PROCESSING";
  const schemaLabel = dataset.pipeline?.schema_type
    ?.replace("_", " ")
    .replace("unstructured prose", "prose→Q&A") ?? null;

  return (
    <div className="group flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{dataset.filename}</p>
            {status && <PipelineBadge status={status} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {dataset.row_count ?? 0} rows
            {schemaLabel && <> · <span className="capitalize">{schemaLabel}</span></>}
            {" · "}{new Date(dataset.uploaded_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canReview && (
          
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onReview}
          >

            Review <ChevronRight className="h-3 w-3" />
          </Button>
        )}
        <button
          onClick={onDelete}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
          aria-label={`Delete ${dataset.filename}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [reviewId, setReviewId]         = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: datasets, isLoading } = useDatasets();
  const deleteDataset = useDeleteDataset();

  const confirmingDataset = datasets?.find((d) => d.id === confirmDeleteId);

  const handleConfirmDelete = () => {
    if (confirmDeleteId == null) return;
    deleteDataset.mutate(confirmDeleteId, {
      onSuccess: () => {
        toast.success("Dataset deleted.");
        setConfirmDeleteId(null);
        if (reviewId === confirmDeleteId) setReviewId(null);
      },
      onError: (err) => {
        toast.error(err.message);
        setConfirmDeleteId(null);
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-sm font-semibold">Datasets</h1>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Upload dataset
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && (datasets?.length ?? 0) === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No datasets yet</p>
            <p className="text-sm text-muted-foreground">
              Upload CSV, PDF, DOCX, TXT, or JSONL to build fine-tuning data.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setUploadOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Upload your first dataset
            </Button>
          </div>
        )}

        {datasets && datasets.length > 0 && (
          <div className="flex flex-col gap-2">
            {datasets.map((dataset) => (
              <DatasetRow
                key={dataset.id}
                dataset={dataset}
                onReview={() => setReviewId(dataset.id)}
                onDelete={() => setConfirmDeleteId(dataset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <UploadDatasetDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onPipelineComplete={(result) => {
          // Auto-open review panel after pipeline completes
          setReviewId(result.id);
        }}
      />

      {/* Review panel (Sheet) */}
      <DatasetReviewPanel
        datasetId={reviewId}
        onClose={() => setReviewId(null)}
      />

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteId != null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete dataset?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{confirmingDataset?.filename}</span>{" "}
            will be permanently removed along with all processed files. Models trained on it are not affected.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteDataset.isPending}
            >
              {deleteDataset.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</>
              ) : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
