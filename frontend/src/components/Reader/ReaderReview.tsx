import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
import { ReaderReviewCard } from "./ReaderReviewCard";
import { ReaderSelect } from "./ReaderSelect";
import { readerAiLimits } from "../../services/readerAiLimits";
import { useTranslation } from "react-i18next";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/readerApiService";
import type {
  ReaderReviewData,
  ReaderFlag,
} from "../../../../shared/types/readerReview";
import type { ReaderDictionaryEntry } from "../../../../shared/types/readerDictionary";
import type { ReaderPassage } from "../../../../shared/types/readerChat";
function Translation({
  entry,
  vocabulary = false,
}: {
  entry?: ReaderDictionaryEntry | null;
  vocabulary?: boolean;
}) {
  const { t } = useTranslation();
  return entry ? (
    <div className={vocabulary ? "reader-vocabulary-translation" : undefined}>
      {vocabulary && (
        <span className="reader-vocabulary-translation-label">
          {t("reader.review.hebrewTranslation")}
        </span>
      )}
      {entry.senses.map((s) => (
        <p key={s.id} dir="auto">
          {s.meanings.join("; ")}
          {(!vocabulary || !s.meanings.length) &&
            s.definition &&
            " — " + s.definition}
        </p>
      ))}
      {entry.attribution && (
        <small>
          <a href={entry.attribution.url} target="_blank" rel="noreferrer">
            {entry.attribution.name}
          </a>{" "}
          ·{" "}
          <a
            href={entry.attribution.licenseUrl}
            target="_blank"
            rel="noreferrer"
          >
            {entry.attribution.license}
          </a>
        </small>
      )}
    </div>
  ) : null;
}
const normalizeWord = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, "")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLowerCase();
export function ReaderReview({
  bookId,
  annotations,
  onOpenAnnotation,
  userId,
  revision,
  onNavigate,
  onPassageNavigate,
  onAskAi,
  onFlagsChanged,
}: {
  bookId: string;
  annotations?: EpubReaderController["annotations"];
  onOpenAnnotation?: (id: string) => void;
  userId: string;
  revision: string;
  onNavigate: (cfi: string) => void;
  onPassageNavigate: (passage: ReaderPassage) => Promise<void>;
  onAskAi: (passage: ReaderPassage) => void;
  onFlagsChanged: (flags: ReaderFlag[]) => void;
}) {
  const { t } = useTranslation();
  const filterId = useId();
  const queryKey = ["readerReview", userId, bookId];
  const data = useQuery({
    queryKey,
    queryFn: () =>
      api.request<ReaderReviewData>("GET", "/" + bookId + "/review"),
    enabled: !!userId && !!bookId,
    refetchOnWindowFocus: false,
  });
  const previousRevision = useRef(revision);
  const { refetch } = data;
  useEffect(() => {
    if (previousRevision.current === revision) return;
    previousRevision.current = revision;
    void refetch();
  }, [revision, refetch]);
  const annotationFlags = annotations?.items.filter(item => item.flagged &&
    !data.data?.flags.some(flag => flag.cfi === item.cfi && flag.endCfi === (item.endCfi || ""))) || [];
  const [filter, setFilter] = useState("pending");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filter]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function update(f: ReaderFlag, remove: boolean) {
    setBusy(f.id);
    setError("");
    try {
      await api.request(
        remove ? "DELETE" : "PATCH",
        "/" + f.bookId + "/flags/" + f.id,
        { reviewed: !f.reviewed },
      );
      const fresh = await data.refetch();
      if (fresh.data) onFlagsChanged(fresh.data.flags);
    } catch {
      setError(t("reader.review.updateError"));
    } finally {
      setBusy("");
    }
  }
  async function updateVocabulary(
    id: string,
    reviewed: boolean,
    remove = false,
  ) {
    setBusy(id);
    setError("");
    try {
      await api.request(
        remove ? "DELETE" : "PATCH",
        "/" + bookId + "/review/vocabulary/" + id,
        { reviewed },
      );
      const fresh = await data.refetch();
      if (fresh.data) onFlagsChanged(fresh.data.flags);
    } catch {
      setError(t("reader.review.updateError"));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="reader-review" aria-label={t("reader.review.title")}>
      <div className="reader-search-heading reader-review-heading">
        <h2>{t("reader.review.heading")}</h2>
        <div className="reader-review-filter">
          <label
            className="reader-sr-only"
            id={filterId + "-label"}
            htmlFor={filterId}
          >
            {t("reader.review.show")}
          </label>
          <ReaderSelect
            id={filterId}
            labelId={filterId + "-label"}
            value={filter}
            options={[
              { value: "pending", label: t("reader.review.pending") },
              { value: "vocabulary", label: t("reader.review.vocabulary") },
              { value: "reviewed", label: t("reader.review.reviewed") },
            ]}
            onChange={setFilter}
          />
        </div>
      </div>
      <div className="reader-review-body" ref={list}>
        {data.isLoading && <p role="status">{t("reader.review.loading")}</p>}
        {data.isError && (
          <p role="alert">
            {t("reader.review.loadError")}{" "}
            <button onClick={() => void data.refetch()}>
              {t("reader.review.retry")}
            </button>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="reader-review-list">
          {filter === "pending" && annotationFlags.map(item => (
            <ReaderReviewCard key={"annotation:" + item.id} text={item.text}
              location={item.chapter} status={t("reader.annotations.title")}
              passage reviewed={false} busy={!!annotations?.busy}
              translation={item.note ? <p dir="auto">{item.note}</p> : undefined}
              onOpen={() => void onPassageNavigate(item)}
              onOpenAnnotation={onOpenAnnotation ? () => onOpenAnnotation(item.id) : undefined}
              removeLabel={t("reader.review.unflagAnnotation")}
              onRemove={() => void annotations?.save({ ...item, flagged: false })} />
          ))}
          {filter === "vocabulary"
            ? data.data?.vocabulary.map((v) => {
                const book = v.books[0];
                return (
                  <ReaderReviewCard
                    key={v.id}
                    vocabulary
                    text={v.headword}
                    location={book?.title || t("reader.review.location")}
                    status={t("reader.review.savedVocabulary")}
                    translation={<Translation entry={v.entry} vocabulary />}
                    reviewed={!!v.reviewed}
                    busy={!!busy}
                    onOpen={
                      book?.location
                        ? () => onNavigate(book.location)
                        : undefined
                    }
                    onReview={() => void updateVocabulary(v.id, !v.reviewed)}
                    onRemove={() =>
                      void updateVocabulary(v.id, !!v.reviewed, true)
                    }
                  />
                );
              })
            : data.data?.flags
                .filter((f) => f.reviewed === (filter === "reviewed"))
                .map((f) => {
                  const annotation = annotations?.items.find(item => item.flagged && item.cfi === f.cfi && (item.endCfi || "") === f.endCfi);
                  const word =
                    /^[a-zA-Z]+(?:['’-][a-zA-Z]+)*$/.test(
                      f.text.replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, ""),
                    ) && f.text.length <= 80;
                  const existing = data.data.vocabulary.find(
                    (v) =>
                      normalizeWord(v.headword) === normalizeWord(f.text) ||
                      normalizeWord(v.entry.word) === normalizeWord(f.text),
                  );
                  return (
                    <ReaderReviewCard
                      key={f.id}
                      text={f.text}
                      location={
                        t("reader.review.location") +
                        (f.chapter ? " · " + f.chapter : "")
                      }
                      date={f.createdAt}
                      status={t(
                        word
                          ? existing
                            ? "reader.review.translatedWord"
                            : "reader.review.pendingWord"
                          : "reader.review.savedPassage",
                      )}
                      passage={!word}
                      context={f.context}
                      translation={<Translation entry={existing?.entry} />}
                      reviewed={f.reviewed}
                      busy={!!busy}
                      onOpen={() => void onPassageNavigate(f)}
                      onOpenAnnotation={annotation && onOpenAnnotation ? () => onOpenAnnotation(annotation.id) : undefined}
                      onReview={() => void update(f, false)}
                      onRemove={() => void update(f, true)}
                      onAskAi={!word ? () => onAskAi(f) : undefined}
                      aiDisabled={f.text.length > readerAiLimits.passage}
                    />
                  );
                })}
        </div>
        {data.isSuccess && !(filter === "pending" && annotationFlags.length) &&
          !(filter === "vocabulary"
            ? data.data.vocabulary.length
            : data.data.flags.filter(
                (f) => f.reviewed === (filter === "reviewed"),
              ).length) && <p>{t("reader.review.empty")}</p>}
      </div>
    </section>
  );
}
