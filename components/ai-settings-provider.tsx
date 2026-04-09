"use client";

import * as React from "react";

import {
  type AiPrompts,
  defaultPrompts,
  loadPrompts,
  savePrompts,
} from "@/lib/ai-prompts-storage";

type AiSettingsContextValue = {
  /** Session only (sessionStorage) — cleared when the browser session ends. */
  apiKey: string;
  setApiKey: (value: string) => void;
  prompts: AiPrompts;
  setPrompts: React.Dispatch<React.SetStateAction<AiPrompts>>;
  promptsHydrated: boolean;
};

const AiSettingsContext = React.createContext<AiSettingsContextValue | null>(
  null,
);
const API_KEY_SESSION_STORAGE_KEY = "recura-openai-api-key-session-v1";

export function AiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = React.useState("");
  const [prompts, setPromptsState] = React.useState<AiPrompts>(defaultPrompts);
  const [promptsHydrated, setPromptsHydrated] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = sessionStorage.getItem(API_KEY_SESSION_STORAGE_KEY) ?? "";
      setApiKey(savedKey);
    }
    setPromptsState(loadPrompts());
    setPromptsHydrated(true);
  }, []);

  const setApiKeyForSession = React.useCallback((value: string) => {
    const next = value.trim();
    setApiKey(next);
    if (typeof window === "undefined") return;
    if (next) {
      sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, next);
    } else {
      sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY);
    }
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
      setApiKey: setApiKeyForSession,
      prompts,
      setPrompts,
      promptsHydrated,
    }),
    [apiKey, prompts, setApiKeyForSession, setPrompts, promptsHydrated],
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
