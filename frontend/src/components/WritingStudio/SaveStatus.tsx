import { useEffect, useState } from "react";
import type { SaveState } from "./draftStore";

// Screen-reader names stay stable ("All changes saved", "Unsaved changes",
// "Saving…") so browser tests and assistive tech can rely on them.
const spoken: Record<SaveState, string> = {
  saved: "All changes saved",
  pending: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed · retry",
};

function ago(savedAt: number, now: number) {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `at ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * Quiet when things are fine, loud when they aren't:
 * saved = faint dot, pending/saving = pulsing dot, error = red "Not saved · Retry".
 */
export function SaveStatus({
  state,
  savedAt,
  onSave,
}: {
  state: SaveState;
  savedAt: number | null;
  onSave: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state !== "saved" || savedAt === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [state, savedAt]);

  const look = state === "pending" ? "saving" : state;
  const tooltip = {
    saved: savedAt === null ? "All changes saved" : `Saved · ${ago(savedAt, now)}`,
    pending: "Saving…",
    saving: "Saving…",
    error: "Your last changes are not saved. Click to retry.",
  }[state];

  return (
    <button
      type="button"
      className={`ws-save ws-save-${look}`}
      onClick={onSave}
      title={tooltip}
      aria-live="polite"
    >
      <span className="ws-save-dot" aria-hidden="true" />
      {state === "error" && <span aria-hidden="true">Not saved · Retry</span>}
      <span className="ws-visually-hidden">{spoken[state]}</span>
    </button>
  );
}
