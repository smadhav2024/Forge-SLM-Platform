import { MessageSquare } from "lucide-react";

export function PlaygroundEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        Start a new conversation
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Select a model above, then type a message or drop a PDF/TXT/DOCX file.
      </p>
    </div>
  );
}
