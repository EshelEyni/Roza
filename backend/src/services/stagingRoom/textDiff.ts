/**
 * Marks what is new in a text compared with an older version, for the Staging Room's
 * reading view. Only additions are marked. Removed text is not shown.
 */

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** One step of lining up two lists: in both, only in the new list (a), or only in the old list (b). */
type Op = { kind: "same" | "a" | "b"; i: number; j: number };

/** Longest-common-subsequence alignment, after trimming the shared start and end. */
export function align(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: Op[] = [];
  for (let k = 0; k < start; k++) ops.push({ kind: "same", i: k, j: k });
  const n = endA - start;
  const m = endB - start;
  if (n * m > 4_000_000) {
    // Too big to line up: everything between the first and last difference counts as changed.
    for (let i = start; i < endA; i++) ops.push({ kind: "a", i, j: start });
    for (let j = start; j < endB; j++) ops.push({ kind: "b", i: endA, j });
  } else {
    const w = m + 1;
    const dp = new Int32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i * w + j] = a[start + i] === b[start + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        ops.push({ kind: "same", i: start + i, j: start + j });
        i++;
        j++;
      } else if (j >= m || (i < n && dp[(i + 1) * w + j] >= dp[i * w + j + 1])) {
        ops.push({ kind: "a", i: start + i, j: start + j });
        i++;
      } else {
        ops.push({ kind: "b", i: start + i, j: start + j });
        j++;
      }
    }
  }
  for (let k = 0; endA + k < a.length; k++) ops.push({ kind: "same", i: endA + k, j: endB + k });
  return ops;
}

export type Segment = { text: string; isNew: boolean };

/** Splits text into words with their trailing spaces, so joining the pieces gives the text back. */
const tokens = (s: string) => s.match(/\S+\s*|\s+/g) ?? [];

/** Marks the words of `next` that are not in `old`, merging neighbours into segments. */
function markWords(next: string, old: string): Segment[] {
  const a = tokens(next);
  const b = tokens(old);
  const ops = align(a.map(norm), b.map(norm));
  const out: Segment[] = [];
  for (const op of ops) {
    if (op.kind === "b") continue;
    const isNew = op.kind === "a" && !!norm(a[op.i]);
    const last = out[out.length - 1];
    if (last && last.isNew === isNew) last.text += a[op.i];
    else out.push({ text: a[op.i], isNew });
  }
  return out;
}

/**
 * For each paragraph of `next`: its text split into segments, with words that are not
 * in `old` marked new. A paragraph that replaced old ones is compared word by word with them.
 */
export function markNew(next: string[], old: string[]): Segment[][] {
  const ops = align(next.map(norm), old.map(norm));
  const out: Segment[][] = next.map((p) => [{ text: p, isNew: false }]);
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === "same") {
      k++;
      continue;
    }
    // A run of changes: new paragraphs [a] replaced old paragraphs [b].
    const added: number[] = [];
    const removed: number[] = [];
    while (k < ops.length && ops[k].kind !== "same") {
      if (ops[k].kind === "a") added.push(ops[k].i);
      else removed.push(ops[k].j);
      k++;
    }
    const oldText = removed.map((j) => old[j]).join(" ");
    for (const i of added) {
      if (!norm(next[i])) continue;
      out[i] = oldText ? markWords(next[i], oldText) : [{ text: next[i], isNew: true }];
    }
  }
  return out;
}
