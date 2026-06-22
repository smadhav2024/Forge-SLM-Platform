import { cn } from "@/lib/utils";
import type { ModelStatus } from "@/types/api";

const STATUS_STYLES: Record<ModelStatus, string> = {
  PENDING: "bg-muted-foreground/40",
  TRAINING: "bg-amber-500 animate-pulse",
  COMPLETED: "bg-emerald-500",
  READY: "bg-emerald-500",
  FAILED: "bg-destructive",
};

export function ModelStatusDot({ status }: { status: ModelStatus }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", STATUS_STYLES[status])}
      aria-label={status}
      title={status}
    />
  );
}
