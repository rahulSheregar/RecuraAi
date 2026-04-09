export type AiPrompts = {
  chatSystem: string;
  audioPrompt: string;
};

export const PROMPTS_STORAGE_KEY = "recura-ai-prompts-v1";

export const defaultPrompts: AiPrompts = {
  chatSystem: "",
  audioPrompt: "",
};

export function loadPrompts(): AiPrompts {
  if (typeof window === "undefined") return defaultPrompts;
  try {
    const raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
    if (!raw) return defaultPrompts;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultPrompts;
    const o = parsed as Record<string, unknown>;
    return {
      chatSystem: typeof o.chatSystem === "string" ? o.chatSystem : "",
      audioPrompt: typeof o.audioPrompt === "string" ? o.audioPrompt : "",
    };
  } catch {
    return defaultPrompts;
  }
}

export function savePrompts(prompts: AiPrompts) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
}
