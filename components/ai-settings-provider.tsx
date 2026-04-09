"use client";

import * as React from "react";

import {
  type AiPrompts,
  defaultPrompts,
  loadPrompts,
  savePrompts,
} from "@/lib/ai-prompts-storage";

type AiSettingsContextValue = {
  /** Session only — never written to localStorage; cleared on full page reload. */
  apiKey: string;
  setApiKey: (value: string) => void;
  prompts: AiPrompts;
  setPrompts: React.Dispatch<React.SetStateAction<AiPrompts>>;
  promptsHydrated: boolean;
};

const AiSettingsContext = React.createContext<AiSettingsContextValue | null>(
  null,
);

export function AiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = React.useState("");
  const [prompts, setPromptsState] = React.useState<AiPrompts>(defaultPrompts);
  const [promptsHydrated, setPromptsHydrated] = React.useState(false);

  React.useEffect(() => {
    setPromptsState(loadPrompts());
    setPromptsHydrated(true);
  }, []);

  const setPrompts = React.useCallback(
    (action: React.SetStateAction<AiPrompts>) => {
      setPromptsState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        savePrompts(next);
        return next;
      });
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      apiKey,
      setApiKey,
      prompts,
      setPrompts,
      promptsHydrated,
    }),
    [apiKey, prompts, setPrompts, promptsHydrated],
  );

  return (
    <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>
  );
}

export function useAiSettings() {
  const ctx = React.useContext(AiSettingsContext);
  if (!ctx) {
    throw new Error("useAiSettings must be used within AiSettingsProvider");
  }
  return ctx;
}
