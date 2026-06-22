import { Badge } from "@/components/ui/badge";
import type { ModelStatus } from "@/types/api";

const variants: Record<ModelStatus, "default" | "warning" | "success" | "destructive" | "secondary"> = {
  PENDING: "secondary",
  TRAINING: "warning",
  READY: "success",
  COMPLETED: "success",
  FAILED: "destructive",
};

const labels: Record<ModelStatus, string> = {
  PENDING: "Pending",
  TRAINING: "Training",
  READY: "Ready",
  COMPLETED: "Ready",
  FAILED: "Failed",
};

export function ModelStatusBadge({ status }: { status: ModelStatus }) {
  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {labels[status] ?? status}
    </Badge>
  );
}
