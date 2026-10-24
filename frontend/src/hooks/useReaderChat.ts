import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReaderConversation,
  ReaderConversationSummary,
  ReaderPassage,
} from "../../../shared/types/readerChat";
import readerChatApiService from "../services/readerChatApiService";
import { createRequestId } from "../services/createRequestId";

export function useReaderChat(bookId: string, getCurrentCfi: () => string) {
  const [conversation, setConversation] = useState<ReaderConversation | null>(
    null,
  );
  const [passage, setPassage] = useState<ReaderPassage | undefined>();
  const [items, setItems] = useState<ReaderConversationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState(false);
  const [error, setError] = useState("");
  const [spoilersAllowed, setSpoilersAllowed] = useState(false);
  const [pending, setPending] = useState<{
    id: string;
    question: string;
  } | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadHistory = useCallback(
    async (before?: string) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError("");
      const version = generation.current;
      try {
        const page = await readerChatApiService.list(bookId, before);
        if (!alive.current || version !== generation.current) return;
        setItems(previous =>
          before ? [...previous, ...page.items] : page.items,
        );
        setCursor(page.nextCursor);
        setHistory(true);
      } catch (err) {
        if (alive.current) setError((err as Error).message);
      } finally {
        busy.current = false;
        if (alive.current) setLoading(false);
      }
    },
    [bookId],
  );

  function start(selected?: ReaderPassage) {
    if (busy.current) return;
    generation.current++;
    setConversation(null);
    setPassage(selected);
    setSpoilersAllowed(false);
    setPending(null);
    setHistory(false);
    setError("");
  }
  async function open(id: string) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const found = await readerChatApiService.getById(bookId, id);
      if (!alive.current) return;
      setConversation(found);
      setPassage(found.passage);
      setSpoilersAllowed(found.spoilersAllowed);
      setPending(null);
      setHistory(false);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }
  async function send(question: string, retryId?: string) {
    if (busy.current || !question.trim()) return false;
    const currentCfi = getCurrentCfi();
    if (!currentCfi) return false;
    const requestId = retryId || createRequestId();
    busy.current = true;
    setSending(true);
    setError("");
    setPending({ id: requestId, question: question.trim() });
    let target = conversation;
    try {
      if (!target) {
        target = await readerChatApiService.create(bookId, passage?.cfi);
        if (!alive.current) return false;
        setConversation(target);
        setPassage(target.passage);
      }
      const updated = await readerChatApiService.send(bookId, target.id, {
        requestId,
        question: question.trim(),
        currentCfi,
        spoilersAllowed,
      });
      if (!alive.current) return false;
      setConversation(updated);
      setPassage(updated.passage);
      setSpoilersAllowed(updated.spoilersAllowed);
      setPending(null);
      return true;
    } catch (err) {
      if (alive.current) {
        setError((err as Error).message);
        if (target) {
          try {
            const saved = await readerChatApiService.getById(bookId, target.id);
            if (alive.current) setConversation(saved);
          } catch {
            /* Keep the local pending question so it can be retried. */
          }
        }
      }
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setSending(false);
    }
  }
  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      await readerChatApiService.remove(bookId, id);
      if (!alive.current) return;
      setItems(previous => previous.filter(item => item.id !== id));
      if (conversation?.id === id) {
        setConversation(null);
        setPassage(undefined);
        setPending(null);
      }
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }
  return {
    conversation,
    passage,
    items,
    cursor,
    loading,
    sending,
    history,
    error,
    spoilersAllowed,
    pending,
    setSpoilersAllowed,
    setHistory,
    start,
    open,
    send,
    remove,
    loadHistory,
  };
}
