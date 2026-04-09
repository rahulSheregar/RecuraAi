"use client";

import { Mic, MessageSquare, Send, Upload, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function mockAssistantReply(userText: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 700));
  return `This is a placeholder response. Wire your model or API here.\n\nYou wrote:\n“${userText.trim().slice(0, 500)}${userText.length > 500 ? "…" : ""}”`;
}

/** Shared height for the Audio upload area and Chat message list. */
const MAIN_PANEL_HEIGHT_CLASS = "h-[min(50vh,22rem)]";

export function AudioChatTabs({ className }: { className?: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const scrollAnchorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!audioFile) {
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudioFile(file);
  };

  const clearAudio = () => {
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const reply = await mockAssistantReply(text);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  const onSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

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
            Upload an audio file to process or preview it locally.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={onFileChange}
          />
          <div
            className={cn(
              MAIN_PANEL_HEIGHT_CLASS,
              "overflow-hidden rounded-lg bg-muted/15",
            )}
          >
            {!audioFile ? (
              <button
                type="button"
                onClick={onPickFile}
                className="hover:border-primary/50 flex h-full w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border/80 bg-muted/30 px-6 transition-colors"
              >
                <Upload className="text-muted-foreground size-10" />
                <span className="text-sm font-medium">Click to upload audio</span>
                <span className="text-muted-foreground text-xs">
                  MP3, WAV, M4A, and other common formats
                </span>
              </button>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{audioFile.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatBytes(audioFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={clearAudio}
                    aria-label="Remove file"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {audioUrl ? (
                  <audio controls src={audioUrl} className="w-full shrink-0" />
                ) : null}
              </div>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onPickFile}>
            {audioFile ? "Replace file" : "Choose file"}
          </Button>
        </TabsContent>

        <TabsContent value="chat" className="mt-0 flex flex-col gap-3">
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
