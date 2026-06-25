"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Navbar } from "@/components/dashboard/navbar";

export function LayoutRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Settings renders its own header and sidebar — skip the main dashboard shell
  if (pathname.startsWith("/dashboard/settings")) {
    return <>{children}</>;
  }

  // Compare page keeps the navbar (for nav tabs) but hides the left sidebar
  if (pathname.startsWith("/dashboard/compare")) {
    return (
      <div className="flex h-svh flex-col">
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}