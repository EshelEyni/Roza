import { ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiUpload } from "react-icons/fi";
import { useQueryClient } from "@tanstack/react-query";
import readerApiService from "../../services/readerApiService";

export function ReaderUpload({ compact = false, sheet = false }: { compact?: boolean; sheet?: boolean }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess(false);
    if (!/\.epub$/i.test(file.name) || file.size > 25 * 1024 * 1024) {
      setError(t("reader.invalidFile"));
      return;
    }
    setProgress(0);
    try {
      await readerApiService.upload(file, setProgress);
      await client.invalidateQueries({ queryKey: ["readerBooks"] });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reader.uploadError"));
    } finally {
      setProgress(null);
    }
  }

  const Icon = compact ? FiPlus : FiUpload;
  return (
    <div className={"reader-upload" + (compact ? " reader-upload-compact" : sheet ? " reader-upload-sheet" : "")}>
      <input
        ref={input}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={onUpload}
        hidden
        disabled={progress !== null}
      />
      <button
        className={compact || sheet ? "reader-button" : "reader-button reader-button-primary"}
        disabled={progress !== null}
        onClick={() => input.current?.click()}
      >
        <Icon aria-hidden="true" />
        {progress === null
          ? t(compact ? "reader.libraryAdd" : "reader.upload")
          : progress === 100
            ? t("reader.processing")
            : t("reader.uploading", { percent: progress })}
      </button>
      {!compact && <p className="reader-hint">{t("reader.uploadHint")}</p>}
      {progress !== null && (
        <progress
          className="reader-upload-progress"
          max={100}
          value={progress}
          aria-label={t("reader.upload")}
        />
      )}
      {error && (
        <p className="reader-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="reader-hint" role="status">
          {t("reader.uploadSuccess")}
        </p>
      )}
    </div>
  );
}
