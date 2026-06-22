"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUploadDataset } from "@/lib/hooks/use-datasets";

export function UploadDatasetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDataset();
  const [filename, setFilename] = useState("");
  const validateAndSet = (f: File) => {
    setValidationError(null);
    if (!f.name.endsWith(".jsonl")) {
      setValidationError("Only .jsonl files are accepted.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleSubmit = () => {
    const displayName = filename.trim();
    if (!file || !displayName) return;

    upload.mutate(
      { file, filename: displayName },
      {
        onSuccess: () => {
          toast.success(`"${displayName}" uploaded successfully.`);
          onOpenChange(false);
          setFile(null);
          setFilename("");
        },
        onError: (err) => {
          // Surface 422 validation detail from backend
          setValidationError(err.message);
        },
      },
    );
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setFile(null);
      setFilename("");
      setValidationError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload dataset</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Upload a{" "}
            <code className="rounded bg-muted px-1 text-xs">.jsonl</code> file
            where each line is a valid JSON object with your fine-tuning
            examples.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataset-name">Dataset name</Label>
            <Input
              id="dataset-name"
              placeholder="e.g. hr-finetune-v1"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used as the display name and storage filename.
            </p>
          </div>
          <div
            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-brand hover:bg-brand/5"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) validateAndSet(f);
            }}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-brand" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Drop .jsonl file here or click to browse
                </span>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".jsonl"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validateAndSet(f);
              e.target.value = "";
            }}
          />

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !filename.trim() || upload.isPending}
          >
            {upload.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
