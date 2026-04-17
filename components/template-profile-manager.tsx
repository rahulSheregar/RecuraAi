 "use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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

type Template = {
  id: string;
  subject: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
};

export function TemplateProfileManager() {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [content, setContent] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/template");
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: string }).error)
            : res.statusText;
        setError(msg);
        setTemplates([]);
        return;
      }
      setTemplates(Array.isArray(data) ? (data as Template[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <p className="text-muted-foreground">Loading templates…</p>;
  if (error)
    return (
      <p className="text-destructive" role="alert">
        {error}
      </p>
    );

  const openCreate = () => {
    setSubject("");
    setContent("");
    setActionError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!subject.trim() || !content.trim()) {
      setActionError("Subject and content are required.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), content: content.trim() }),
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: string }).error)
            : res.statusText;
        setActionError(msg);
        return;
      }
      const created = data as Template;
      setTemplates((list) => [...list, created]);
      setDialogOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create template");
    } finally {
      setBusy(false);
    }
  };

  if (templates.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button onClick={openCreate}>Add Template</Button>
        </div>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No templates</CardTitle>
            <CardDescription>No email templates have been created yet.</CardDescription>
          </CardHeader>
        </Card>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg" showCloseButton>
            <DialogHeader>
              <DialogTitle>Add Template</DialogTitle>
              <DialogDescription>Create a new email template.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-1">
              <div className="grid gap-2">
                <Label htmlFor="tmpl-subject">Subject</Label>
                <Input
                  id="tmpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tmpl-content">Content</Label>
                <Textarea
                  id="tmpl-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                />
              </div>
              {actionError ? (
                <p className="text-destructive text-sm" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy} className="ml-2">
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>Add Template</Button>
      </div>
      <ul className="flex flex-col gap-3">
        {templates.map((t) => (
          <li key={t.id}>
            <Card>
              <CardHeader className="border-b border-border pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{t.subject}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="whitespace-pre-wrap text-sm">
                  {t.content}
                </CardDescription>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add Template</DialogTitle>
            <DialogDescription>Create a new email template.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="tmpl-subject">Subject</Label>
              <Input id="tmpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tmpl-content">Content</Label>
              <Textarea
                id="tmpl-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            </div>
            {actionError ? (
              <p className="text-destructive text-sm" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy} className="ml-2">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}