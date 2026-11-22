/**
 * Small helpers for staged data: stable hashing (to tell whether a text changed),
 * rich text, and keeping chapter notes attached to their quote when text changes.
 */
import crypto from "crypto";
import type { ChapterAnnotation, RichText, SlateElement } from "../../../../shared/types/stagingRoom";
import { toSlate } from "./slate";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DEFAULT_COLOR = "#937e6e";

/** Plain JSON copy without Mongo-only fields (_id, __v) and without `false` flags (Roza's defaults). */
export function clean<T = any>(value: unknown): T {
  if (value === undefined) return undefined as T;
  const walk = (x: any): any => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(x)) {
        if (k === "_id" || k === "__v" || v === false || v === undefined) continue;
        out[k] = walk(v);
      }
      return out;
    }
    return x;
  };
  return walk(JSON.parse(JSON.stringify(value)));
}

/** Order-stable form used only for comparing. Also drops null, "" and [] (Roza treats them like missing). */
export function canon(value: unknown): any {
  const walk = (x: any): any => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      const out: any = {};
      for (const k of Object.keys(x).sort()) {
        const v = walk(x[k]);
        if (v === null || v === undefined || v === false || v === "") continue;
        if (Array.isArray(v) && !v.length) continue;
        if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) continue;
        out[k] = v;
      }
      return out;
    }
    return x;
  };
  return walk(clean(value));
}

export const hashOf = (value: unknown) =>
  crypto.createHash("sha1").update(JSON.stringify(canon(value) ?? null)).digest("hex").slice(0, 16);

export const asSlate = (v: RichText | undefined): SlateElement[] => (Array.isArray(v) ? v : toSlate(v || ""));

/* ---------- keeping notes attached when the text changes ---------- */

type Point = { path: number[]; offset: number };

/** Every text leaf of a document, in order, with its path. */
function leavesOf(nodes: SlateElement[]): { path: number[]; text: string }[] {
  const out: { path: number[]; text: string }[] = [];
  const walk = (node: any, path: number[]) => {
    if (typeof node?.text === "string" && !Array.isArray(node.children)) out.push({ path, text: node.text });
    else (node?.children || []).forEach((c: any, i: number) => walk(c, [...path, i]));
  };
  (nodes || []).forEach((n, i) => walk(n, [i]));
  return out;
}

const samePath = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** The text a range covers (like Slate's Editor.string), or undefined if a point is not in the document. */
function rangeText(leaves: ReturnType<typeof leavesOf>, a: Point, b: Point): string | undefined {
  const ia = leaves.findIndex((l) => samePath(l.path, a.path));
  const ib = leaves.findIndex((l) => samePath(l.path, b.path));
  if (ia < 0 || ib < 0 || a.offset > leaves[ia].text.length || b.offset > leaves[ib].text.length) return undefined;
  let [s, e, so, eo] = [ia, ib, a.offset, b.offset];
  if (s > e || (s === e && so > eo)) [s, e, so, eo] = [e, s, eo, so];
  if (s === e) return leaves[s].text.slice(so, eo);
  return [leaves[s].text.slice(so), ...leaves.slice(s + 1, e).map((l) => l.text), leaves[e].text.slice(0, eo)].join("");
}

/** Find the quote in the text (within one paragraph) and return a range around it. */
export function findQuote(nodes: SlateElement[], quote: string): { anchor: Point; focus: Point } | undefined {
  if (!quote) return undefined;
  for (let block = 0; block < (nodes || []).length; block++) {
    const leaves = leavesOf([nodes[block]]).map((l) => ({ ...l, path: [block, ...l.path.slice(1)] }));
    const joined = leaves.map((l) => l.text).join("");
    const at = joined.indexOf(quote);
    if (at < 0) continue;
    const point = (pos: number, end: boolean): Point => {
      let start = 0;
      for (let i = 0; i < leaves.length; i++) {
        const len = leaves[i].text.length;
        const last = i === leaves.length - 1;
        if (pos < start + len || (pos === start + len && (end || last))) return { path: leaves[i].path, offset: pos - start };
        start += len;
      }
      const l = leaves[leaves.length - 1];
      return { path: l.path, offset: l.text.length };
    };
    return { anchor: point(at, false), focus: point(at + quote.length, true) };
  }
  return undefined;
}

/**
 * Makes sure every note still points at its quote in `text`. Notes whose range no longer
 * covers the quote are moved to where the quote is now; if the quote is gone they become
 * "unattached" (anchor null), which Roza shows as "text removed" and lets you re-attach.
 */
export function reattachNotes(
  text: SlateElement[],
  notes: ChapterAnnotation[] | undefined,
): { notes: ChapterAnnotation[] | undefined; moved: number; detached: number } {
  if (!notes) return { notes, moved: 0, detached: 0 };
  const leaves = leavesOf(text);
  let moved = 0;
  let detached = 0;
  const out = notes.map((n) => {
    if (n.general || !n.anchor) return n;
    const current = rangeText(leaves, n.anchor.anchor, n.anchor.focus);
    if (current !== undefined && (current.slice(0, 500) === n.quote || !n.quote)) return n;
    const found = findQuote(text, n.quote);
    if (found) {
      moved++;
      return { ...n, anchor: found };
    }
    detached++;
    return { ...n, anchor: null };
  });
  return { notes: out, moved, detached };
}
