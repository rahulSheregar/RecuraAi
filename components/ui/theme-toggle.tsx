"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modes = ["light", "dark", "system"] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-8 w-[5.5rem] items-center rounded-lg border border-border bg-muted/40",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label="Theme appearance"
    >
      {modes.map((mode) => (
        <Button
          key={mode}
          type="button"
          variant={theme === mode ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2"
          onClick={() => setTheme(mode)}
          aria-pressed={theme === mode}
          title={
            mode === "light"
              ? "Light"
              : mode === "dark"
                ? "Dark"
                : "System"
          }
        >
          {mode === "light" && <Sun className="size-3.5" aria-hidden />}
          {mode === "dark" && <Moon className="size-3.5" aria-hidden />}
          {mode === "system" && <Monitor className="size-3.5" aria-hidden />}
          <span className="sr-only">
            {mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System"}
          </span>
        </Button>
      ))}
    </div>
  );
}
