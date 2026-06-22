"use client";

import { useState } from "react";
import { useModels } from "@/lib/hooks/use-models";
import { ModelCard } from "@/components/models/model-card";
import { RegisterModelDialog } from "@/components/models/register-model-dialog";
import { UploadModelDialog } from "@/components/models/upload-model-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Box, Upload, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ModelsPage() {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: models, isLoading } = useModels();

  const baseModels = models?.filter((m) => m.is_base_model) ?? [];
  const userModels = models?.filter((m) => !m.is_base_model) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-sm font-semibold">Models</h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              Add model
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setRegisterOpen(true)}>
              <Box className="h-4 w-4" />
              Fine-tune a model
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload your model
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && models?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Box className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No models yet</p>
            <p className="text-sm text-muted-foreground">
              Register a fine-tune or upload your own model to get started.
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => setRegisterOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Fine-tune a model
              </Button>
              <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5" />
                Upload model
              </Button>
            </div>
          </div>
        )}

        {!isLoading && models && models.length > 0 && (
          <div className="flex flex-col gap-8">
            {/* User models section */}
            {userModels.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your models
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {userModels.map((model) => (
                    <ModelCard key={model.id} model={model} />
                  ))}
                </div>
              </section>
            )}

            {/* Base / system models section */}
            {baseModels.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  System models
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {baseModels.map((model) => (
                    <ModelCard key={model.id} model={model} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <RegisterModelDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <UploadModelDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
