"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegisterModel } from "@/lib/hooks/use-model-actions";
import { useDatasets } from "@/lib/hooks/use-datasets";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BASE_MODELS = ["llama3.2-1b", "qwen2.5-3b", "deepseek-r1-distill-qwen-1.5b", "gemma3-1b"];

export function RegisterModelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [datasetId, setDatasetId] = useState<string>("");
  const [baseModelKey, setBaseModelKey] = useState("llama3.2-1b");

  const { data: datasets, isLoading: datasetsLoading } = useDatasets();
  const register = useRegisterModel();

  const handleSubmit = () => {
    if (!displayName.trim() || !datasetId) {
      toast.error("Name and dataset are required.");
      return;
    }

    register.mutate(
      { display_name: displayName.trim(), dataset_id: Number(datasetId), base_model_key: baseModelKey },
      {
        onSuccess: () => {
          toast.success(`Model "${displayName}" registered.`);
          onOpenChange(false);
          setDisplayName("");
          setDatasetId("");
          setBaseModelKey("llama3.2-1b");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register model</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="model-name">Display name</Label>
            <Input
              id="model-name"
              placeholder="e.g. HRMind-v1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="base-model">Base model</Label>
            <Select value={baseModelKey} onValueChange={setBaseModelKey}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a base model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Base Models</SelectLabel>
                  {BASE_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dataset">Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a dataset" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Datasets</SelectLabel>
                  {datasets?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.filename} {d.row_count ? `(${d.row_count} rows)` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={register.isPending}>
            {register.isPending ? "Registering..." : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}