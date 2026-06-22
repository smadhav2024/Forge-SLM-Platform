"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { TrainingLogViewer } from "@/components/models/training-log-viewer";
import { useStartTraining } from "@/lib/hooks/use-model-actions";
import { useDatasets } from "@/lib/hooks/use-datasets";
import type { ModelSummary } from "@/types/api";
import { DATASET_STORAGE_PREFIX } from "@/lib/config";

export function ModelCard({ model }: { model: ModelSummary }) {
  const [showLogs, setShowLogs] = useState(false);
  const startTraining = useStartTraining();
  const { data: datasets } = useDatasets();

  const isTraining = model.status === "TRAINING";
  const canTrain = model.status === "PENDING" || model.status === "FAILED";

  const handleStartTraining = () => {
    // Find the dataset path from the model's dataset_id
    const dataset = datasets?.find((d) => d.id === model.dataset_id);
    if (!dataset) {
      toast.error("Dataset not found for this model.");
      return;
    }

    startTraining.mutate(
      { modelId: model.id, datasetPath: `${DATASET_STORAGE_PREFIX}/${dataset.filename}` },
      {
        onSuccess: () => {
          toast.success("Training started.");
          setShowLogs(true);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const statusVariant: Record<string, "default" | "warning" | "success" | "destructive" | "secondary"> = {
    PENDING: "secondary",
    TRAINING: "warning",
    READY: "success",
    COMPLETED: "success",
    FAILED: "destructive",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ModelStatusDot status={model.status} />
            <CardTitle className="text-sm">{model.display_name}</CardTitle>
          </div>
          <Badge variant={statusVariant[model.status] ?? "secondary"}>
            {model.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Base: {model.base_model_key} · Created {new Date(model.created_at).toLocaleDateString()}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {canTrain && (
            <Button
              size="sm"
              onClick={handleStartTraining}
              disabled={startTraining.isPending}
            >
              <Play className="h-3.5 w-3.5" />
              {startTraining.isPending ? "Starting..." : "Start training"}
            </Button>
          )}
          {(isTraining || model.status === "COMPLETED" || model.status === "READY") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLogs((v) => !v)}
            >
              {showLogs ? "Hide logs" : "View logs"}
            </Button>
          )}
        </div>

        {showLogs && (
          <TrainingLogViewer modelId={model.id} isTraining={isTraining} />
        )}
      </CardContent>
    </Card>
  );
}