export const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

export const statusLabel: Record<string, string> = {
  new: "New",
  same: "Up to date",
  differs: "Differs",
  pull: "Newer in Roza ↓",
  push: "Newer here ↑",
  conflict: "Changed in both ⚠",
  "prod-only": "Only in Roza",
};
