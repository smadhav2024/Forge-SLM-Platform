"use client";

import { useEffect, useRef } from "react";
import { useTrainingLogs } from "@/lib/hooks/use-training-logs";
import { cn } from "@/lib/utils";

export function TrainingLogViewer({
  modelId,
  isTraining,
}: {
  modelId: number;
  isTraining: boolean;
}) {
  const { logs, isDone } = useTrainingLogs(modelId, isTraining);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Training logs
        </span>
        {isTraining && !isDone && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Training
          </span>
        )}
        {isDone && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        )}
      </div>

      <div className="h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5">
        {logs.length === 0 ? (
          <span className="text-muted-foreground">
            {isTraining ? "Waiting for logs..." : "No logs yet."}
          </span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap",
                line.toLowerCase().includes("error") && "text-destructive",
                line.toLowerCase().includes("completed") && "text-emerald-600 font-medium"
              )}
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}