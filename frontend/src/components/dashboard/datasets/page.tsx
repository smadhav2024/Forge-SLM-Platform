"use client";

import { useState } from "react";
import { useDatasets, useDeleteDataset } from "@/lib/hooks/use-datasets";
import { UploadDatasetDialog } from "@/components/datasets/upload-dataset-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Database, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function DatasetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
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
      },
      onError: (err) => {
        toast.error(err.message);
        setConfirmDeleteId(null);
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-sm font-semibold">Datasets</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Upload dataset
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && datasets?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No datasets yet</p>
            <p className="text-sm text-muted-foreground">
              Upload a .jsonl file to get started with fine-tuning.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Upload your first dataset
            </Button>
          </div>
        )}

        {datasets && datasets.length > 0 && (
          <div className="flex flex-col gap-2">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                className="group flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{dataset.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataset.row_count ?? 0} rows ·{" "}
                      {new Date(dataset.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setConfirmDeleteId(dataset.id)}
                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Delete ${dataset.filename}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <UploadDatasetDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDeleteId != null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete dataset?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{confirmingDataset?.filename}</span>{" "}
            will be permanently removed. Models trained on this dataset will not be affected.
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
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
