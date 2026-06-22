"use client";

import { useState } from "react";
import { useDatasets } from "@/lib/hooks/use-datasets";
import { UploadDatasetDialog } from "@/components/datasets/upload-dataset-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Database, FileText } from "lucide-react";

export default function DatasetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: datasets, isLoading } = useDatasets();

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
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{dataset.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataset.row_count ? `${dataset.row_count} rows · ` : ""}
                      {new Date(dataset.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {dataset.status && (
                  <Badge variant="secondary">{dataset.status}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <UploadDatasetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}