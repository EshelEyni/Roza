import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import api from "../../services/readerApiService";
import type { ReaderFlag } from "../../../../shared/types/readerReview";
import type { ReaderTextSelection } from "../../types/reader";
import type { EpubRuntime } from "./useEpubRuntime";
export function useReaderFlags(
  runtime: EpubRuntime,
  bookId: string,
  userId: string,
  chapter: string,
) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ReaderFlag[]>([]);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const pending = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    setReady(false);
    api
      .request<ReaderFlag[]>("GET", "/" + bookId + "/flags")
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Invalid flags response");
        if (active) {
          setItems(data);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setMessage(t("reader.review.loadFlagsError"));
      });
    return () => {
      active = false;
    };
  }, [bookId, userId, t]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);
  const has = (s: ReaderTextSelection) =>
    items.find((f) => f.cfi === s.cfi && f.endCfi === (s.endCfi || ""));
  async function save(
    s: ReaderTextSelection,
    toggle = false,
    contextText?: string,
  ) {
    if (!ready) {
      setMessage(t("reader.review.notReady"));
      return;
    }
    const key = JSON.stringify([s.cfi, s.endCfi || ""]);
    if (pending.current.has(key)) return;
    pending.current.add(key);
    try {
      const existing = has(s);
      if (existing && toggle) {
        await api.request("DELETE", "/" + bookId + "/flags/" + existing.id);
        setItems((items) => items.filter((f) => f.id !== existing.id));
        setMessage(t("reader.review.removed"));
      } else if (existing) setMessage(t("reader.review.duplicate"));
      else {
        const book = runtime.epubRef.current;
        const section = book?.spine.get(s.cfi);
        let context = contextText || s.text;
        if (!contextText) {
          try {
            const range = await book?.getRange(s.cfi);
            context =
              range?.startContainer.parentElement?.textContent?.trim() ||
              s.text;
          } catch {
            /* selected text remains available */
          }
        }
        const flag = await api.request<ReaderFlag>(
          "PUT",
          "/" + bookId + "/flags",
          {
            cfi: s.cfi,
            endCfi: s.endCfi || "",
            text: s.text,
            chapter: section
              ? book?.navigation.get(section.href)?.label || chapter
              : chapter,
            context: context.slice(0, 100000),
          },
        );
        setItems((items) => [...items.filter((f) => f.id !== flag.id), flag]);
        setMessage(t("reader.review.saved"));
      }
    } catch {
      setMessage(t("reader.review.saveError"));
    } finally {
      pending.current.delete(key);
    }
  }
  return { save, has, ready, message, items, sync: setItems };
}
