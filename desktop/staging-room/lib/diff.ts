import type { DiffLine } from "../../../shared/types/stagingRoom";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Paragraph-level diff, like `git diff`: which paragraphs are only in the local
 * version, only in Roza, or in both. Unchanged runs far from a change collapse
 * into a "skip" line.
 */
export function diffParagraphs(local: string[], roza: string[], context = 2): DiffLine[] {
  const a = local.map(norm).filter(Boolean);
  const b = roza.map(norm).filter(Boolean);
  const n = a.length;
  const m = b.length;

  let ops: DiffLine[];
  if (n * m > 4_000_000) {
    // Too big to align: show the two versions one after the other.
    ops = [...a.map((text) => ({ kind: "local" as const, text })), ...b.map((text) => ({ kind: "roza" as const, text }))];
  } else {
    // dp[i][j] = longest common run of a[i..] and b[j..]
    const w = m + 1;
    const dp = new Int32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    ops = [];
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) {
        ops.push({ kind: "same", text: a[i] });
        i++;
        j++;
      } else if (j >= m || (i < n && dp[(i + 1) * w + j] >= dp[i * w + j + 1])) {
        ops.push({ kind: "local", text: a[i] });
        i++;
      } else {
        ops.push({ kind: "roza", text: b[j] });
        j++;
      }
    }
  }

  // Keep unchanged paragraphs only near a change.
  const changed = ops.map((o) => o.kind !== "same");
  const keep = ops.map((_, k) => {
    for (let d = -context; d <= context; d++) if (changed[k + d]) return true;
    return false;
  });
  const out: DiffLine[] = [];
  let skipped = 0;
  ops.forEach((o, k) => {
    if (keep[k]) {
      if (skipped) out.push({ kind: "skip", count: skipped });
      skipped = 0;
      out.push(o);
    } else skipped++;
  });
  if (skipped) out.push({ kind: "skip", count: skipped });
  return out;
}
