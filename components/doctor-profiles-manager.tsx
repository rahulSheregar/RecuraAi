"use client";

import { FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type DaySchedule,
  type DoctorProfile,
  DAY_ORDER,
  emptyProfile,
  formatScheduleSummary,
} from "@/lib/doctor-profiles";
import { cn } from "@/lib/utils";

function cloneProfile(p: DoctorProfile): DoctorProfile {
  return {
    ...p,
    schedule: p.schedule.map((s) => ({ ...s })),
  };
}

export function DoctorProfilesManager() {
  const [profiles, setProfiles] = React.useState<DoctorProfile[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DoctorProfile>(() => emptyProfile());

  const refreshProfiles = React.useCallback(async () => {
    const res = await fetch("/api/doctors");
    const data = (await res.json()) as unknown;
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: string }).error)
          : res.statusText;
      setLoadError(msg);
      return;
    }
    setLoadError(null);
    setProfiles(Array.isArray(data) ? (data as DoctorProfile[]) : []);
  }, []);

  React.useEffect(() => {
    setHydrated(true);
    void refreshProfiles();
  }, [refreshProfiles]);

  const openCreate = () => {
    setDraft(emptyProfile());
    setDialogOpen(true);
  };

  const openEdit = (p: DoctorProfile) => {
    setDraft(cloneProfile(p));
    setDialogOpen(true);
  };

  const saveDraft = async () => {
    const name = draft.name.trim();
    if (!name) return;

    setBusy(true);
    setActionError(null);
    try {
      const body: DoctorProfile = {
        ...draft,
        id: draft.id,
        name,
        expertise: draft.expertise.trim(),
      };
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      const saved = data as DoctorProfile;
      setProfiles((list) => {
        const idx = list.findIndex((x) => x.id === saved.id);
        if (idx === -1) return [...list, saved];
        const copy = [...list];
        copy[idx] = saved;
        return copy;
      });
      setDialogOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this doctor profile?")) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/doctors/${encodeURIComponent(id)}`, {
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
      setProfiles((list) => list.filter((p) => p.id !== id));
    } finally {
      setBusy(false);
    }
  };

  const loadSampleScenario = async () => {
    if (
      !window.confirm(
        "Replace all doctor profiles in the database with the built-in edge-case scenario (11 doctors)?",
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/doctors/seed-sample", { method: "POST" });
      const data = (await res.json()) as {
        doctors?: DoctorProfile[];
        error?: string;
      };
      if (!res.ok) {
        setActionError(data.error ?? res.statusText);
        return;
      }
      setProfiles(data.doctors ?? []);
    } finally {
      setBusy(false);
    }
  };

  const updateScheduleDay = (day: DaySchedule["day"], patch: Partial<DaySchedule>) => {
    setDraft((d) => ({
      ...d,
      schedule: d.schedule.map((row) =>
        row.day === day ? { ...row, ...patch } : row,
      ),
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadSampleScenario()}
          disabled={busy}
          className="gap-1.5"
        >
          <FlaskConical className="size-4" />
          Load sample doctors
        </Button>
        <Button type="button" onClick={openCreate} disabled={busy} className="gap-1.5">
          <Plus className="size-4" />
          Add profile
        </Button>
      </div>

      {loadError ? (
        <p className="text-destructive text-sm" role="alert">
          Could not load doctors: {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      {!hydrated ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No profiles yet</CardTitle>
            <CardDescription>
              Add a doctor with their name, areas of expertise, and weekly working
              hours.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {profiles.map((p) => (
            <li key={p.id}>
              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <CardDescription className="line-clamp-2 text-pretty">
                        {p.expertise || "No expertise added yet."}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => openEdit(p)}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => void remove(p.id)}
                        aria-label={`Delete ${p.name}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Working hours
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {formatScheduleSummary(p.schedule)}
                  </p>
                  <ul className="mt-2 space-y-1 text-muted-foreground text-xs sm:text-sm">
                    {p.schedule.map((row) => (
                      <li key={row.day} className="flex justify-between gap-2">
                        <span>{row.label}</span>
                        <span className="tabular-nums text-foreground/80">
                          {row.closed ? "Closed" : `${row.start} – ${row.end}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit profile" : "New doctor profile"}</DialogTitle>
            <DialogDescription>
              Name, expertise, and weekly hours. You can mark days closed or set start
              and end times.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="doc-name">Full name</Label>
              <Input
                id="doc-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Dr. Jane Smith"
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doc-expertise">Expertise</Label>
              <Textarea
                id="doc-expertise"
                value={draft.expertise}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, expertise: e.target.value }))
                }
                placeholder="e.g. Cardiology, preventive care, chronic disease management"
                rows={3}
                className="min-h-[4.5rem] resize-y"
              />
            </div>
            <div className="grid gap-2">
              <Label>Working hours</Label>
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                {DAY_ORDER.map(({ key, label }) => {
                  const row = draft.schedule.find((s) => s.day === key);
                  if (!row) return null;
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 border-border/60 border-b pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="flex min-w-[7rem] items-center gap-2">
                        <input
                          type="checkbox"
                          id={`closed-${key}`}
                          checked={row.closed}
                          onChange={(e) =>
                            updateScheduleDay(key, { closed: e.target.checked })
                          }
                          className={cn(
                            "size-4 rounded border-input accent-primary",
                          )}
                        />
                        <Label
                          htmlFor={`closed-${key}`}
                          className="cursor-pointer font-normal"
                        >
                          {label}
                        </Label>
                      </div>
                      {!row.closed ? (
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Input
                            type="time"
                            value={row.start}
                            onChange={(e) =>
                              updateScheduleDay(key, { start: e.target.value })
                            }
                            className="w-[7.5rem]"
                            aria-label={`${label} start`}
                          />
                          <span className="text-muted-foreground text-xs">to</span>
                          <Input
                            type="time"
                            value={row.end}
                            onChange={(e) =>
                              updateScheduleDay(key, { end: e.target.value })
                            }
                            className="w-[7.5rem]"
                            aria-label={`${label} end`}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveDraft()}
              disabled={!draft.name.trim() || busy}
            >
              {draft.id ? "Save changes" : "Create profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
