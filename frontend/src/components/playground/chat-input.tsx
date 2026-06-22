"use client";

import { useState, useRef, KeyboardEvent, DragEvent } from "react";
import { ArrowUp, Square, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [".pdf", ".txt", ".docx"];

export function ChatInput({
  onSend,
  onStop,
  onFileDropped,
  isStreaming,
  isDisabled,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  onFileDropped: (file: File) => void;
  isStreaming: boolean;
  isDisabled: boolean;
}) {
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileDropped(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileDropped(file);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border bg-background transition-colors",
        isDragging && "border-brand bg-brand/5"
      )}
    >
      {isDragging && (
        <div className="flex items-center justify-center py-6 text-sm text-brand">
          Drop {ACCEPTED_TYPES.join(", ")} file
        </div>
      )}

      {!isDragging && (
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={isDisabled ? "Select a model to start" : "Enter prompt or drop files…"}
            disabled={isDisabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-6 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
          />

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileInput}
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={isDisabled || isStreaming}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {isStreaming ? (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onStop}
              aria-label="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleSend}
              disabled={!text.trim() || isDisabled}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}