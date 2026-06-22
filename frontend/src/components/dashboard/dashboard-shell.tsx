"use client";

import { useState } from "react";
import { Navbar } from "@/components/dashboard/navbar";
import { LeftSidebar } from "@/components/dashboard/left-sidebar";
import { RegisterModelDialog } from "@/components/models/register-model-dialog";
import { UploadDatasetDialog } from "@/components/datasets/upload-dataset-dialog";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);

  return (
    <div className="flex h-svh flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          onCreateModel={() => setModelDialogOpen(true)}
          onCreateDataset={() => setDatasetDialogOpen(true)}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      <RegisterModelDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
      />
      <UploadDatasetDialog
        open={datasetDialogOpen}
        onOpenChange={setDatasetDialogOpen}
      />
    </div>
  );
}