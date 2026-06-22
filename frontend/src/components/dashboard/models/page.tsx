"use client";

import { useState } from "react";
import { useModels } from "@/lib/hooks/use-models";
import { ModelCard } from "@/components/models/model-card";
import { RegisterModelDialog } from "@/components/models/register-model-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Box } from "lucide-react";

export default function ModelsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: models, isLoading } = useModels();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-sm font-semibold">Models</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Register model
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && models?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Box className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No models yet</p>
            <p className="text-sm text-muted-foreground">
              Register a model and attach a dataset to start fine-tuning.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Register your first model
            </Button>
          </div>
        )}

        {models && models.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        )}
      </div>

      <RegisterModelDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}