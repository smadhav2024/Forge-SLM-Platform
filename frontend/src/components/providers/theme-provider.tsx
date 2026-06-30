"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface Props {
  children: React.ReactNode;
}

export default function AppThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange
      // Prevents next-themes from injecting an inline <script> tag that
      // React can't reconcile during SSR → fixes the "script tag while
      // rendering" console error.
      nonce={undefined}
      storageKey="forge-theme"
    >
      {children}
    </NextThemesProvider>
  );
}