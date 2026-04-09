"use client";

import { AiSettingsProvider } from "@/components/ai-settings-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AiSettingsProvider>{children}</AiSettingsProvider>
    </ThemeProvider>
  );
}
