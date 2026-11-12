import { useTranslation } from "react-i18next";
import { annotationColors } from "../../../../shared/types/readerAnnotations";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";

export function ReaderAnnotations({
  annotations: a,
  onNavigate,
}: {
  annotations: EpubReaderController["annotations"];
  onNavigate: (cfi: string) => void;
}) {
  const { t } = useTranslation();
  const draft = a.draft;
  return (
    <section className="reader-annotations" aria-busy={a.busy || a.loading}>
      {a.error && (
        <p role="alert">
          {t("reader.annotations." + a.error)}{" "}
          {a.error === "loadError" && (
            <button
              className="reader-button"
              onClick={a.retry}
              disabled={a.busy}
            >
              {t("reader.retry")}
            </button>
          )}
        </p>
      )}
      {a.loading && <p role="status">{t("reader.annotations.loading")}</p>}
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void a.save(draft);
          }}
        >
          <blockquote dir="auto">{draft.text}</blockquote>
          <p>{draft.chapter}</p>
          <fieldset disabled={a.busy}>
            <legend>{t("reader.annotations.color")}</legend>
            {annotationColors.map((color) => (
              <button
                type="button"
                key={color}
                className={
                  "reader-button reader-annotation-color color-" + color
                }
                aria-pressed={draft.color === color}
                onClick={() => a.setDraft({ ...draft, color })}
              >
                {t("reader.annotations." + color)}
              </button>
            ))}
          </fieldset>
          <label htmlFor="reader-annotation-note">
            {t("reader.annotations.note")}
          </label>
          <textarea
            id="reader-annotation-note"
            dir="auto"
            value={draft.note}
            maxLength={10000}
            disabled={a.busy}
            onChange={(event) =>
              a.setDraft({ ...draft, note: event.target.value })
            }
          />
          <div className="reader-annotation-actions">
            <button className="reader-button" disabled={a.busy} type="submit">
              {t("reader.annotations.save")}
            </button>
            <button
              className="reader-button"
              disabled={a.busy}
              type="button"
              onClick={() => a.setDraft(null)}
            >
              {t("reader.annotations.cancel")}
            </button>
            {draft.id && (
              <button
                className="reader-button"
                disabled={a.busy}
                type="button"
                onClick={() => void a.remove(draft.id!)}
              >
                {t("reader.annotations.delete")}
              </button>
            )}
            {!!draft.note && (
              <button
                className="reader-button"
                disabled={a.busy}
                type="button"
                onClick={() => a.setDraft({ ...draft, note: "" })}
              >
                {t("reader.annotations.deleteNote")}
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          {!a.loading && !a.items.length && (
            <p>{t("reader.annotations.empty")}</p>
          )}
          <ol>
            {a.items.map((item) => (
              <li
                key={item.id}
                className={"reader-annotation-card color-" + item.color}
              >
                <small>
                  {item.chapter} · {t("reader.annotations." + item.color)}
                </small>
                <button
                  className="reader-annotation-passage"
                  onClick={() => onNavigate(item.cfi)}
                >
                  <blockquote dir="auto">{item.text}</blockquote>
                </button>
                {item.note && <p dir="auto">{item.note}</p>}
                <div className="reader-annotation-actions">
                  <button
                    className="reader-button"
                    disabled={a.busy}
                    onClick={() => a.setDraft(item)}
                  >
                    {t("reader.annotations.edit")}
                  </button>
                  <button
                    className="reader-button"
                    disabled={a.busy}
                    onClick={() => void a.remove(item.id)}
                  >
                    {t("reader.annotations.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
