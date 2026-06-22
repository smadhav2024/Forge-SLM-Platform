"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Cpu,
  Upload,
  Database,
  Calendar,
  Hash,
  Layers,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelStatusBadge } from "@/components/models/model-status-badge";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { TrainingLogViewer } from "@/components/models/training-log-viewer";
import { useModels } from "@/lib/hooks/use-models";
import { useDatasets } from "@/lib/hooks/use-datasets";
import { useStartTraining, useDeleteModel } from "@/lib/hooks/use-model-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value ?? "—"}</span>
      </div>
    </div>
  );
}

export default function ModelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [showLogs, setShowLogs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: models, isLoading } = useModels();
  const { data: datasets } = useDatasets();
  const startTraining = useStartTraining();
  const deleteModel = useDeleteModel();

  const model = models?.find((m) => String(m.id) === params.id);
  const dataset = datasets?.find((d) => d.id === model?.dataset_id);

  const isTraining = model?.status === "TRAINING";
  const canTrain = model?.status === "PENDING" || model?.status === "FAILED";
  const isUserOwned = !model?.is_base_model;

  const handleStartTraining = () => {
    if (!model || !dataset) {
      toast.error("Dataset not found for this model.");
      return;
    }
    startTraining.mutate(
      { modelId: model.id, datasetPath: dataset.file_path },
      {
        onSuccess: () => {
          toast.success("Training started.");
          setShowLogs(true);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDelete = () => {
    if (!model) return;
    deleteModel.mutate(model.id, {
      onSuccess: () => {
        toast.success(`"${model.display_name}" removed.`);
        router.push("/dashboard/models");
      },
      onError: (err) => toast.error(err.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Model not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/models")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to models
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => router.push("/dashboard/models")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-2">
          <ModelStatusDot status={model.status} />
          <h1 className="text-sm font-semibold">{model.display_name}</h1>
          <ModelStatusBadge status={model.status} />
        </div>
        {isUserOwned && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Two-column layout: meta + actions */}
          <div className="grid gap-6 md:grid-cols-[1fr_280px]">

            {/* Left — metadata */}
            <div className="flex flex-col gap-0">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Model info
              </h2>
              <div className="divide-y rounded-xl border bg-card">
                <div className="px-4">
                  <MetaRow
                    icon={Cpu}
                    label="Architecture / base"
                    value={model.base_model_key}
                  />
                </div>
                <div className="px-4">
                  <MetaRow
                    icon={model.is_uploaded ? Upload : Layers}
                    label="Type"
                    value={
                      model.is_base_model
                        ? "System model"
                        : model.is_uploaded
                        ? "User uploaded"
                        : "Fine-tuned"
                    }
                  />
                </div>
                {dataset && (
                  <div className="px-4">
                    <MetaRow
                      icon={Database}
                      label="Training dataset"
                      value={
                        <span className="flex items-center gap-1.5">
                          {dataset.filename}
                          {dataset.row_count && (
                            <span className="text-xs font-normal text-muted-foreground">
                              ({dataset.row_count} rows)
                            </span>
                          )}
                        </span>
                      }
                    />
                  </div>
                )}
                {model.dataset_id && !dataset && (
                  <div className="px-4">
                    <MetaRow
                      icon={Database}
                      label="Training dataset"
                      value={`Dataset #${model.dataset_id}`}
                    />
                  </div>
                )}
                <div className="px-4">
                  <MetaRow
                    icon={Hash}
                    label="Model ID"
                    value={
                      <span className="font-mono text-xs">#{model.id}</span>
                    }
                  />
                </div>
                <div className="px-4">
                  <MetaRow
                    icon={Calendar}
                    label="Added"
                    value={new Date(model.created_at).toLocaleString()}
                  />
                </div>
                {model.parameter_count && (
                  <div className="px-4">
                    <MetaRow
                      icon={Cpu}
                      label="Parameters"
                      value={model.parameter_count}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right — actions */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </h2>
              <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                {canTrain && (
                  <Button
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleStartTraining}
                    disabled={startTraining.isPending || !dataset}
                  >
                    {startTraining.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {startTraining.isPending ? "Starting…" : "Start training"}
                  </Button>
                )}
                {(isTraining ||
                  model.status === "COMPLETED" ||
                  model.status === "READY") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowLogs((v) => !v)}
                  >
                    {showLogs ? "Hide training logs" : "View training logs"}
                  </Button>
                )}
                {canTrain && !dataset && (
                  <p className="text-xs text-muted-foreground">
                    No dataset attached — training is unavailable.
                  </p>
                )}
                {isTraining && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Training in progress…
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Training logs (full width, below grid) */}
          {showLogs && (
            <div className="mt-6">
              <TrainingLogViewer modelId={model.id} isTraining={isTraining} />
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove model?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{model.display_name}</span> will
            be permanently removed. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteModel.isPending}
            >
              {deleteModel.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing…</>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
