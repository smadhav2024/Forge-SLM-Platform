"use client";

import { X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PendingFiles({
  files,
  isUploading,
  onRemove,
}: {
  files: File[];
  isUploading: boolean;
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2">
      {files.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="flex items-center gap-1.5 rounded-md border bg-secondary px-2 py-1 text-xs"
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <FileText className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="max-w-32 truncate text-foreground">{file.name}</span>
          {!isUploading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}