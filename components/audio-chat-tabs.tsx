"use client";

import { Mic, MessageSquare, Send, Upload, X } from "lucide-react";
import * as React from "react";

import { useAiSettings } from "@/components/ai-settings-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type AudioStep = "queued" | "transcribing" | "responding" | "completed" | "failed";
type AudioJob = {
  id: string;
  fileName: string;
  fileSize: number;
  step: AudioStep;
  transcript?: string;
  response?: string;
  error?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shared height for the Audio upload area and Chat message list. */
const MAIN_PANEL_HEIGHT_CLASS = "h-[min(50vh,22rem)]";

export function AudioChatTabs({ className }: { className?: string }) {
  const { apiKey, prompts } = useAiSettings();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [audioFiles, setAudioFiles] = React.useState<File[]>([]);
  const [audioJobs, setAudioJobs] = React.useState<AudioJob[]>([]);
  const [isProcessingAudio, setIsProcessingAudio] = React.useState(false);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatThreadId, setChatThreadId] = React.useState(() => crypto.randomUUID());
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const scrollAnchorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setAudioFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAudioAt = (idx: number) => {
    setAudioFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const processAudioFiles = async () => {
    if (audioFiles.length === 0 || isProcessingAudio) return;
    setIsProcessingAudio(true);
    const filesToProcess = [...audioFiles];
    setAudioFiles([]);

    const updateJob = (jobId: string, patch: Partial<AudioJob>) => {
      setAudioJobs((jobs) =>
        jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)),
      );
    };

    const runOne = async (file: File) => {
      const jobId = crypto.randomUUID();
      setAudioJobs((jobs) => [
        {
          id: jobId,
          fileName: file.name,
          fileSize: file.size,
          step: "queued",
        },
        ...jobs,
      ]);

      try {
        updateJob(jobId, { step: "transcribing" });
        const threadId = `audio-${jobId}`;
        const form = new FormData();
        form.append("file", file);
        form.append("threadId", threadId);
        if (apiKey.trim()) form.append("apiKey", apiKey.trim());

        const transcribeRes = await fetch("/api/audio/transcribe", {
          method: "POST",
          body: form,
        });
        const transcribeData = (await transcribeRes.json()) as {
          transcript?: string;
          runId?: string;
          threadId?: string;
          error?: string;
        };
        if (!transcribeRes.ok || !transcribeData.transcript || !transcribeData.runId) {
          updateJob(jobId, {
            step: "failed",
            error:
              transcribeData.error ??
              (!transcribeData.runId
                ? "Transcription did not return a workflow run id."
                : `Transcription failed (${transcribeRes.status}).`),
          });
          return;
        }

        const transcript = transcribeData.transcript.trim();
        updateJob(jobId, { step: "responding", transcript });

        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: transcript }],
            threadId: transcribeData.threadId ?? threadId,
            existingRunId: transcribeData.runId,
            apiKey: apiKey.trim() || undefined,
            schedulingPromptTemplate:
              prompts.schedulingPromptTemplate.trim() || undefined,
          }),
        });
        const chatData = (await chatRes.json()) as { message?: string; error?: string };
        if (!chatRes.ok) {
          updateJob(jobId, {
            step: "failed",
            error: chatData.error ?? `AI response failed (${chatRes.status}).`,
          });
          return;
        }

        updateJob(jobId, {
          step: "completed",
          response: chatData.message ?? "(empty reply)",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unexpected error.";
        updateJob(jobId, { step: "failed", error: msg });
      }
    };

    try {
      await Promise.allSettled(filesToProcess.map((file) => runOne(file)));
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          threadId: chatThreadId,
          apiKey: apiKey.trim() || undefined,
          schedulingPromptTemplate:
            prompts.schedulingPromptTemplate.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.error || `Request failed (${res.status}).`,
          },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message || "(empty reply)",
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error.";
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${msg}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [
    input,
    isSending,
    messages,
    chatThreadId,
    apiKey,
    prompts.schedulingPromptTemplate,
  ]);

  const onSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const stepIndex = (step: AudioStep) =>
    step === "queued"
      ? 0
      : step === "transcribing"
        ? 1
        : step === "responding"
          ? 2
          : 3;

  return (
    <div
      className={cn(
        "flex w-full flex-col rounded-xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <Tabs defaultValue="audio" className="gap-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-full">
          <TabsTrigger value="audio" className="gap-2">
            <Mic className="size-4" aria-hidden />
            Audio
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="size-4" aria-hidden />
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audio" className="mt-0 flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Upload one or more audio files. Each file is transcribed and then processed
            for scheduling response.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="sr-only"
            onChange={onFileChange}
          />
          <div
            className={cn(
              MAIN_PANEL_HEIGHT_CLASS,
              "overflow-hidden rounded-lg bg-muted/15",
            )}
          >
            {audioFiles.length === 0 ? (
              <button
                type="button"
                onClick={onPickFile}
                className="hover:border-primary/50 flex h-full w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border/80 bg-muted/30 px-6 transition-colors"
              >
                <Upload className="text-muted-foreground size-10" />
                <span className="text-sm font-medium">Click to upload audio files</span>
                <span className="text-muted-foreground text-xs">
                  MP3, WAV, M4A, and other common formats (multi-select supported)
                </span>
              </button>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
                {audioFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${file.size}-${idx}`}
                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-background/70 p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-muted-foreground text-xs">{formatBytes(file.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAudioAt(idx)}
                      aria-label={`Remove ${file.name}`}
                      disabled={isProcessingAudio}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onPickFile}>
              {audioFiles.length > 0 ? "Add more files" : "Choose files"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void processAudioFiles()}
              disabled={isProcessingAudio || audioFiles.length === 0}
            >
              {isProcessingAudio
                ? "Processing…"
                : `Process ${audioFiles.length || ""} audio${audioFiles.length === 1 ? "" : "s"}`}
            </Button>
          </div>

          {audioJobs.length > 0 ? (
            <div className="space-y-3">
              {audioJobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-border bg-background/70 p-3">
                  <div className="mb-2">
                    <p className="truncate font-medium">{job.fileName}</p>
                    <p className="text-muted-foreground text-xs">{formatBytes(job.fileSize)}</p>
                  </div>
                  <ol className="mb-3 grid grid-cols-4 gap-2">
                    {[
                      { key: "queued", label: "Queued" },
                      { key: "transcribing", label: "Transcribe" },
                      { key: "responding", label: "Respond" },
                      { key: "completed", label: job.step === "failed" ? "Failed" : "Done" },
                    ].map((s, idx) => {
                      const active = stepIndex(job.step) >= idx;
                      const failed = job.step === "failed" && idx === 3;
                      return (
                        <li key={s.key} className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "flex size-5 items-center justify-center rounded-full border text-[11px] font-medium",
                              active && "border-primary bg-primary text-primary-foreground",
                              !active && "border-border text-muted-foreground",
                              failed && "border-destructive bg-destructive text-destructive-foreground",
                            )}
                          >
                            {idx + 1}
                          </span>
                          <span className={cn(!active && "text-muted-foreground")}>{s.label}</span>
                        </li>
                      );
                    })}
                  </ol>
                  {job.error ? (
                    <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      {job.error}
                    </p>
                  ) : null}
                  {job.transcript ? (
                    <p className="mt-2 text-xs">
                      <span className="font-medium">Transcript:</span> {job.transcript}
                    </p>
                  ) : null}
                  {job.response ? (
                    <p className="mt-2 text-xs">
                      <span className="font-medium">AI response:</span> {job.response}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="chat" className="mt-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Session: <code>{chatThreadId.slice(0, 8)}</code>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSending}
              onClick={() => {
                setMessages([]);
                setInput("");
                setChatThreadId(crypto.randomUUID());
              }}
            >
              New chat session
            </Button>
          </div>
          <ScrollArea
            className={cn(
              MAIN_PANEL_HEIGHT_CLASS,
              "rounded-lg border border-border bg-muted/15 pr-3",
            )}
          >
            <div className="flex flex-col gap-3 p-3">
              {messages.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Start a conversation with the assistant.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[92%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap",
                      m.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "border-border bg-background mr-auto border",
                    )}
                  >
                    {m.content}
                  </div>
                ))
              )}
              {isSending ? (
                <div className="text-muted-foreground mr-auto text-sm italic">
                  Assistant is typing…
                </div>
              ) : null}
              <div ref={scrollAnchorRef} />
            </div>
          </ScrollArea>
          <form
            onSubmit={onSubmitChat}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the AI…"
              rows={2}
              className="min-h-[2.75rem] flex-1 resize-none"
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button type="submit" disabled={isSending || !input.trim()} className="shrink-0">
              <Send className="size-4" />
              Send
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
