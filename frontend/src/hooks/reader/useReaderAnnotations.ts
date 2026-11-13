import { useEffect, useRef, useState } from "react";
import { EpubCFI, type Contents } from "epubjs";
import type {
  ReaderAnnotation,
  ReaderAnnotationInput,
} from "../../../../shared/types/readerAnnotations";
import type { ReaderTextSelection } from "../../types/reader";
import type { EpubRuntime } from "./useEpubRuntime";
import api from "../../services/readerApiService";
import { readSelectionRange } from "../../services/readerSelectionRange";

export function useReaderAnnotations(
  runtime: EpubRuntime,
  bookId: string,
  userId: string,
  chapter: string,
  openPanel: () => void,
  closeLookup: () => void,
  previewing = false,
) {
  const [items, setItems] = useState<ReaderAnnotation[]>([]);
  const [draft, setDraft] = useState<
    (ReaderAnnotationInput & { id?: string }) | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const scope = bookId + ":" + userId;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const pending = useRef(false);
  const base = "/" + bookId + "/annotations";
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setItems([]);
    setDraft(null);
    setLoading(true);
    setError("");
    api
      .request<ReaderAnnotation[]>("GET", base)
      .then((data) => {
        if (!Array.isArray(data))
          throw new Error("Invalid annotations response");
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError("loadError");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [base, userId, attempt]);

  const rendition = runtime.renditionRef.current;
  useEffect(() => {
    const book = runtime.epubRef.current;
    if (!rendition || !book) return;
    let active = true;
    const ranges = new Map<string, ReaderAnnotation[]>();
    const added: string[] = [];
    const draw = async () => {
      const visible: ReaderAnnotation[] = draft && previewing
        ? [...items.filter(item => item.id !== draft.id), { ...draft, id: draft.id || "__preview" }]
        : items;
      for (const item of visible) {
        if (item.color === "none" && !item.note.trim()) continue;
        try {
          const pieces = item.endCfi
            ? (
                await readSelectionRange(book, item.cfi, item.endCfi)
              ).pieces.map((piece) => piece.cfi)
            : [item.cfi];
          if (!active) return;
          for (const cfi of pieces)
            ranges.set(cfi, [...(ranges.get(cfi) || []), item]);
        } catch {
          if (active) setError("restoreError");
        }
      }
      if (!active) return;
      for (const [cfi, owners] of ranges) {
        const item = owners[owners.length - 1];
        // Reserve underline for saved annotations. Its full-range SVG rect is styled
        // as a highlight, avoiding epub.js's CFI+highlight collisions with AI/search.
        try {
          rendition.annotations.add(
            "underline",
            cfi,
            {
              annotationId: item.id,
              color: item.color,
              note: owners.some((owner) => owner.note) ? "true" : "false",
            },
            (event: Event) => {
              // epub.js also invokes this on touchstart; wait for click to preserve swipes.
              if (event.type !== "click") return;
              if (
                (rendition.getContents() as unknown as Contents[]).some(
                  (content) =>
                    !!content.document.getSelection()?.toString().trim(),
                )
              )
                return;
              if (item.id === "__preview") return;
              closeLookup();
              setDraft(item);
              openPanel();
            },
            "reader-saved-annotation",
            { "stroke-opacity": "1", "mix-blend-mode": "multiply" },
          );
          added.push(cfi);
        } catch {
          setError("restoreError");
        }
      }
    };
    void draw();
    return () => {
      active = false;
      for (const cfi of added) rendition.annotations.remove(cfi, "underline");
    };
  }, [rendition, items, draft, previewing, runtime, closeLookup, openPanel]);

  function select(selection: ReaderTextSelection, note: boolean) {
    if (loading || error === "loadError") {
      openPanel();
      return;
    }
    const existing = items.find(
      (item) =>
        item.cfi === selection.cfi &&
        (item.endCfi || "") === (selection.endCfi || ""),
    );
    closeLookup();
    if (existing && !note) {
      void remove(existing.id);
      return;
    }
    const book = runtime.epubRef.current;
    const section = book?.spine.get(selection.cfi);
    const title = section
      ? book?.navigation.get(section.href)?.label || chapter || section.href
      : chapter;
    const next = existing || {
      cfi: selection.cfi,
      endCfi: selection.endCfi || "",
      text: selection.text,
      chapter: title,
      color: "none" as const,
      note: "",
    };
    if (note || !existing) {
      setDraft(next);
      openPanel();
    } else {
      setDraft(next);
      void save(next);
    }
  }
  async function save(value: ReaderAnnotationInput) {
    if (pending.current) return;
    if (value.color === "none" && !value.note.trim()) {
      const existing = items.find(item => item.cfi === value.cfi && (item.endCfi || "") === (value.endCfi || ""));
      if (existing) await remove(existing.id);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await api.request<ReaderAnnotation>("PUT", base, value);
      if (currentScope.current !== scope) return;
      setItems((current) => [
        ...current.filter((item) => item.id !== saved.id),
        saved,
      ]);
      setDraft(null);
    } catch {
      if (currentScope.current === scope) {
        setError("saveError");
        openPanel();
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.request("DELETE", base + "/" + id);
      if (currentScope.current !== scope) return;
      setItems((current) => current.filter((item) => item.id !== id));
      setDraft(null);
    } catch {
      if (currentScope.current === scope) {
        setError("saveError");
        openPanel();
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const compare = new EpubCFI().compare;
  const ordered = [...items].sort((a, b) => {
    try {
      return compare(a.cfi, b.cfi) || a.id.localeCompare(b.id);
    } catch {
      return 0;
    }
  });
  return {
    items: ordered,
    draft,
    setDraft,
    error,
    loading,
    busy,
    select,
    save,
    remove,
    retry: () => setAttempt((value) => value + 1),
  };
}
