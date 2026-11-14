import { readerAiLimits } from "../../services/readerAiLimits";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReaderAccess } from "../../components/Reader/ReaderAccess";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import api from "../../services/readerApiService";
import type {
  ReaderReviewData,
  ReaderFlag,
} from "../../../../shared/types/readerReview";
import type { ReaderDictionaryEntry } from "../../../../shared/types/readerDictionary";
import "../../styles/app/_reader.scss";
function Translation({ entry }: { entry?: ReaderDictionaryEntry | null }) {
  return entry ? (
    <div>
      {entry.senses.map((s) => (
        <p key={s.id} dir="auto">
          {s.meanings.join("; ")}
          {s.definition && " — " + s.definition}
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
function Review() {
  const { t } = useTranslation();
  const { loggedInUser } = useLoginWithToken();
  const client = useQueryClient();
  const queryKey = ["readerReview", loggedInUser?.id];
  const data = useQuery({
    queryKey,
    queryFn: () => api.request<ReaderReviewData>("GET", "/review"),
    enabled: !!loggedInUser,
    refetchOnWindowFocus: false,
  });
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [translations, setTranslations] = useState<
    Record<string, ReaderDictionaryEntry | null>
  >({});
  async function update(f: ReaderFlag, remove: boolean) {
    setBusy(f.id);
    setError("");
    try {
      await api.request(
        remove ? "DELETE" : "PATCH",
        "/" + f.bookId + "/flags/" + f.id,
        { reviewed: !f.reviewed },
      );
      await client.invalidateQueries({ queryKey });
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
        "/review/vocabulary/" + id,
        { reviewed },
      );
      await client.invalidateQueries({ queryKey });
    } catch {
      setError(t("reader.review.updateError"));
    } finally {
      setBusy("");
    }
  }
  async function translate(f: ReaderFlag) {
    setBusy(f.id);
    setError("");
    try {
      const entry = await api.request<ReaderDictionaryEntry | null>(
        "POST",
        "/" + f.bookId + "/flags/" + f.id + "/translation",
      );
      setTranslations((current) => ({ ...current, [f.id]: entry }));
      if (!entry) setError(t("reader.review.notFound"));
    } catch {
      setError(t("reader.review.translateError"));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Link className="reader-button" to="/reader">
        {t("reader.review.library")}
      </Link>
      <h1>{t("reader.review.title")}</h1>
      <label>
        {t("reader.review.show")}{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">{t("reader.review.pending")}</option>
          <option value="vocabulary">{t("reader.review.vocabulary")}</option>
          <option value="reviewed">{t("reader.review.reviewed")}</option>
        </select>
      </label>
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
        {filter === "vocabulary"
          ? data.data?.vocabulary.map((v) => (
              <article key={v.id}>
                <h2>{v.headword}</h2>
                <Translation entry={v.entry} />
                {v.books.map((b) => (
                  <p key={b.bookId}>
                    <Link
                      to={
                        "/reader/" +
                        b.bookId +
                        (b.location
                          ? "?location=" + encodeURIComponent(b.location)
                          : "")
                      }
                    >
                      {b.title} · {t("reader.review.open")}
                    </Link>
                  </p>
                ))}
                <div className="reader-review-actions">
                  <button
                    className="reader-button"
                    disabled={!!busy}
                    onClick={() => void updateVocabulary(v.id, !v.reviewed)}
                  >
                    {v.reviewed
                      ? t("reader.review.markPending")
                      : t("reader.review.markReviewed")}
                  </button>
                  <button
                    className="reader-button"
                    disabled={!!busy}
                    onClick={() =>
                      void updateVocabulary(v.id, !!v.reviewed, true)
                    }
                  >
                    {t("reader.review.removeVocabulary")}
                  </button>
                </div>
              </article>
            ))
          : data.data?.flags
              .filter((f) => f.reviewed === (filter === "reviewed"))
              .map((f) => {
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
                  <article key={f.id}>
                    <p className="reader-eyebrow">
                      {data.data.books.find((b) => b.id === f.bookId)?.title} ·{" "}
                      {f.chapter}
                    </p>
                    <h2 dir="auto">{f.text}</h2>
                    {f.context !== f.text && (
                      <details>
                        <summary>{t("reader.review.context")}</summary>
                        <p dir="auto">{f.context}</p>
                      </details>
                    )}
                    <small>{new Date(f.createdAt).toLocaleDateString()}</small>
                    <Translation
                      entry={translations[f.id] || existing?.entry}
                    />
                    <div className="reader-review-actions">
                      <Link
                        className="reader-button"
                        to={"/reader/" + f.bookId + "?flag=" + f.id}
                      >
                        {t("reader.review.open")}
                      </Link>
                      {word ? (
                        <button
                          className="reader-button"
                          disabled={!!busy}
                          onClick={() => void translate(f)}
                        >
                          {t("reader.review.translate")}
                        </button>
                      ) : f.text.length > readerAiLimits.passage ? (
                        <button
                          className="reader-button"
                          disabled
                          title={t("reader.chat.selectionLimit")}
                        >
                          {t("reader.review.askAi")}
                        </button>
                      ) : (
                        <Link
                          className="reader-button"
                          to={
                            "/reader/" +
                            f.bookId +
                            "?flag=" +
                            f.id +
                            "&action=ai"
                          }
                        >
                          {t("reader.review.askAi")}
                        </Link>
                      )}
                      <button
                        className="reader-button"
                        disabled={!!busy}
                        onClick={() => void update(f, false)}
                      >
                        {f.reviewed
                          ? t("reader.review.markPending")
                          : t("reader.review.markReviewed")}
                      </button>
                      <button
                        className="reader-button"
                        disabled={!!busy}
                        onClick={() => void update(f, true)}
                      >
                        {t("reader.review.remove")}
                      </button>
                    </div>
                  </article>
                );
              })}
      </div>
      {data.isSuccess &&
        !(filter === "vocabulary"
          ? data.data.vocabulary.length
          : data.data.flags.filter(
              (f) => f.reviewed === (filter === "reviewed"),
            ).length) && <p>{t("reader.review.empty")}</p>}
    </>
  );
}
export default function ReaderReviewPage() {
  return (
    <main className="reader-library reader-review">
      <ReaderAccess>
        <Review />
      </ReaderAccess>
    </main>
  );
}
