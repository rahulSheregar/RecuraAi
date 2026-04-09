"use client";

import * as React from "react";

import { useAiSettings } from "@/components/ai-settings-provider";
import { Button } from "@/components/ui/button";
import { clearRecuraLocalStorage } from "@/lib/client-storage-reset";
import { defaultPrompts } from "@/lib/ai-prompts-storage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SettingsView() {
  const { apiKey, setApiKey, prompts, setPrompts, promptsHydrated } = useAiSettings();
  const [draftApiKey, setDraftApiKey] = React.useState(apiKey);
  const [showKey, setShowKey] = React.useState(false);
  const [keySavedMessage, setKeySavedMessage] = React.useState<string | null>(null);
  const [resetBusy, setResetBusy] = React.useState(false);
  const [resetMessage, setResetMessage] = React.useState<string | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    setDraftApiKey(apiKey);
  }, [apiKey]);

  const resetApplication = async () => {
    setResetBusy(true);
    setResetMessage(null);
    setResetError(null);
    try {
      const res = await fetch("/api/reset-app", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResetError(data.error ?? res.statusText);
        return;
      }
      setApiKey("");
      clearRecuraLocalStorage();
      setPrompts(defaultPrompts);
      setResetMessage("Application data was reset. Profiles and workflows start empty.");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>OpenAI API key</CardTitle>
          <CardDescription className="space-y-2 text-pretty">
            <span className="block">
              Paste a key here and save it for this <strong>browser session</strong>.
              It is kept in session storage (not localStorage or disk). When you send a
              chat message, it is sent to this app&apos;s server once, used to call
              OpenAI, and not stored on the server.
            </span>
            <span className="block">
              It remains available after reload while the browser session is active, and
              is cleared when the browser session ends. For a persistent setup,
              set <code className="rounded bg-muted px-1 py-0.5 text-xs">OPENAI_API_KEY</code>{" "}
              in <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> on
              the machine running Next.js — then you can leave this field blank.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="openai-key">API key (session only)</Label>
            <Input
              id="openai-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              value={draftApiKey}
              onChange={(e) => {
                setDraftApiKey(e.target.value);
                setKeySavedMessage(null);
              }}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowKey((s) => !s)}
              >
                {showKey ? "Hide" : "Show"} key
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setApiKey(draftApiKey.trim());
                  setKeySavedMessage("API key saved for this browser session.");
                }}
              >
                Save key
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraftApiKey("");
                  setApiKey("");
                  setKeySavedMessage("Cleared from this browser session.");
                }}
              >
                Clear key
              </Button>
            </div>
            {keySavedMessage ? (
              <p className="text-muted-foreground text-xs" role="status">
                {keySavedMessage}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>
            Saved in this browser (localStorage). Used when calling the AI from chat and
            reserved for future audio flows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!promptsHydrated ? (
            <p className="text-muted-foreground text-sm">Loading prompts…</p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="prompt-chat">Chat — system prompt</Label>
                <Textarea
                  id="prompt-chat"
                  value={prompts.chatSystem}
                  onChange={(e) =>
                    setPrompts((p) => ({ ...p, chatSystem: e.target.value }))
                  }
                  placeholder="Optional. Overrides default assistant behavior for the chat tab (e.g. tone, medical documentation style, brevity)."
                  rows={5}
                  className="min-h-[6rem] resize-y"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-audio">Audio — instructions</Label>
                <Textarea
                  id="prompt-audio"
                  value={prompts.audioPrompt}
                  onChange={(e) =>
                    setPrompts((p) => ({ ...p, audioPrompt: e.target.value }))
                  }
                  placeholder="Optional. For future use when processing uploaded audio (e.g. how to summarize or transcribe)."
                  rows={5}
                  className="min-h-[6rem] resize-y"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-scheduling-template">
                  Scheduling — extraction prompt template
                </Label>
                <Textarea
                  id="prompt-scheduling-template"
                  value={prompts.schedulingPromptTemplate}
                  onChange={(e) =>
                    setPrompts((p) => ({
                      ...p,
                      schedulingPromptTemplate: e.target.value,
                    }))
                  }
                  placeholder="Template used for AI extraction in /api/chat."
                  rows={12}
                  className="min-h-[14rem] resize-y font-mono text-xs"
                />
                <p className="text-muted-foreground text-xs">
                  Available placeholders: <code>{"{{today_date}}"}</code>,{" "}
                  <code>{"{{timezone}}"}</code>, <code>{"{{doctor_info_json}}"}</code>,{" "}
                  <code>{"{{clinic_style_instructions}}"}</code>.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Reset application</CardTitle>
          <CardDescription className="text-pretty">
            Return the app to a clean slate: empty the server database, clear the API key kept in this tab’s memory, and wipe Recura entries in localStorage (including prompts and any legacy profile cache).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setResetConfirmOpen(true)}
            disabled={resetBusy}
          >
            {resetBusy ? "Resetting…" : "Reset to initial state"}
          </Button>
          {resetMessage ? (
            <p className="text-muted-foreground text-sm text-pretty" role="status">
              {resetMessage}
            </p>
          ) : null}
          {resetError ? (
            <p className="text-destructive text-sm text-pretty" role="alert">
              {resetError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent showCloseButton={!resetBusy}>
          <DialogHeader>
            <DialogTitle>Reset application data?</DialogTitle>
            <DialogDescription>
              This deletes all rows in the SQLite database (doctors, workflow runs,
              appointments), clears your OpenAI key from memory, and removes Recura
              keys from localStorage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetConfirmOpen(false)}
              disabled={resetBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void resetApplication();
                setResetConfirmOpen(false);
              }}
              disabled={resetBusy}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
