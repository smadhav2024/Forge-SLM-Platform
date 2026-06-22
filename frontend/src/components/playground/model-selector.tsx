"use client";

import { useModels } from "@/lib/hooks/use-models";
import { cn } from "@/lib/utils";

export function ModelSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { data: models, isLoading } = useModels();

  return (
    <select
      value={value?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading || !models?.length}
      className={cn(
        "h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <option value="" disabled>
        {isLoading ? "Loading..." : models?.length ? "Select model" : "No models yet"}
      </option>
      {models?.map((m) => {
        // Be tolerant of records created before statuses were normalized to
        // uppercase by the API.
        const status = m.status.toUpperCase();
        const isAvailable = status === "READY" || status === "COMPLETED";

        return (
          <option key={m.id} value={String(m.id)} disabled={!isAvailable}>
            {m.display_name} {status === "TRAINING" ? "(training…)" : ""}
          </option>
        );
      })}
    </select>
  );
}
