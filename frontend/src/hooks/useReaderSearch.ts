import { useCallback, useEffect, useRef, useState } from "react";
import type { Book } from "epubjs";
import type { ReaderSearchResult, ReaderSearchSession } from "../types/reader";
import readerSearchService from "../services/readerSearchService";

export function useReaderSearch(book: Book | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReaderSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const session = useRef<ReaderSearchSession | null>(null);
  const controller = useRef<AbortController | null>(null);
  const resultCount = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    session.current = null;
    resultCount.current = 0;
    busy.current = false;
    setQuery("");
    setResults([]);
    setTotal(0);
    setSearching(false);
    setLoadingMore(false);
    setHasSearched(false);
    setError(false);
    return () => {
      controller.current?.abort();
    };
  }, [book]);

  const search = useCallback(
    async (value: string) => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      session.current = null;
      resultCount.current = 0;
      busy.current = false;
      const normalized = value.trim().replace(/\s+/g, " ");
      setQuery(normalized);
      setResults([]);
      setTotal(0);
      setError(false);
      setHasSearched(!!normalized);
      setLoadingMore(false);
      if (!book || !normalized) {
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const found = await readerSearchService.createSession(
          book,
          normalized,
          request.signal,
          count => {
            if (!request.signal.aborted) setTotal(count);
          },
        );
        if (request.signal.aborted) return;
        session.current = found;
        const firstPage = await readerSearchService.getResults(
          book,
          found,
          0,
          request.signal,
        );
        if (request.signal.aborted) return;
        resultCount.current = firstPage.length;
        setResults(firstPage);
      } catch {
        if (!request.signal.aborted) setError(true);
      } finally {
        if (!request.signal.aborted) setSearching(false);
      }
    },
    [book],
  );

  const loadMore = useCallback(async () => {
    const request = controller.current;
    const found = session.current;
    if (
      !book ||
      !request ||
      request.signal.aborted ||
      !found ||
      busy.current ||
      resultCount.current >= found.total
    )
      return;
    busy.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const next = await readerSearchService.getResults(
        book,
        found,
        resultCount.current,
        request.signal,
      );
      if (request.signal.aborted) return;
      resultCount.current += next.length;
      setResults(previous => [...previous, ...next]);
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [book]);

  return {
    query,
    results,
    total,
    searching,
    loadingMore,
    error,
    hasSearched,
    hasMore: results.length < total,
    search,
    loadMore,
  };
}
