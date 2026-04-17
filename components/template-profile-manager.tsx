"use client";

import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [content, setContent] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

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

  const openCreate = () => {
    setEditingId(null);
    setSubject("");
    setContent("");
    setActionError(null);
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setSubject(t.subject);
    setContent(t.content);
    setActionError(null);
    setDialogOpen(true);
  };

  const onDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setActionError(null);
    }
  };

  const submit = async () => {
    if (!subject.trim() || !content.trim()) {
      setActionError("Subject and content are required.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      if (editingId) {
        const res = await fetch("/api/template", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            subject: subject.trim(),
            content: content.trim(),
          }),
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
        const updated = data as Template;
        setTemplates((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      } else {
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
      }
      setDialogOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/template?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
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
      setTemplates((list) => list.filter((t) => t.id !== id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete template");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading templates…</p>;
  if (error)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-destructive" role="alert">
          {error}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={busy}
          className="gap-1.5"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
        <Button type="button" onClick={openCreate} disabled={busy} className="gap-1.5">
          <Plus className="size-4" />
          Add template
        </Button>
      </div>

      {!dialogOpen && actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No templates</CardTitle>
            <CardDescription>No email templates have been created yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Card>
                <CardHeader className="border-b border-border pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg">{t.subject}</CardTitle>
                      <p className="text-muted-foreground font-mono text-xs">id: {t.id}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => openEdit(t)}
                        disabled={busy}
                        aria-label={`Edit ${t.subject}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setConfirmDeleteId(t.id)}
                        disabled={busy}
                        aria-label={`Delete ${t.subject}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
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
      )}

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit template" : "Add template"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update subject and body. Changes apply immediately after you save."
                : "Create a new email template for notifications."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="tmpl-subject">Subject</Label>
              <Input
                id="tmpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tmpl-content">Content</Label>
              <Textarea
                id="tmpl-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                disabled={busy}
              />
            </div>
            {dialogOpen && actionError ? (
              <p className="text-destructive text-sm" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              This removes the template from the database. References in workflows may break if
              they still use this id.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteId) return;
                const id = confirmDeleteId;
                setConfirmDeleteId(null);
                void remove(id);
              }}
              disabled={busy}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
