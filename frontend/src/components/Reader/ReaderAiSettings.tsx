import { readerAiLimits } from "../../services/readerAiLimits";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { readerAiModels, type ReaderAiSettings } from "../../../../shared/types/readerAiSettings";
import readerAiSettingsApiService from "../../services/readerAiSettingsApiService";

const modelDescriptionKeys: Record<NonNullable<ReaderAiSettings["model"]>, string> = {
  default: "server",
  "gpt-4.1-mini": "mini",
  "gpt-6-luna": "luna",
  "gpt-6.1-terra": "terra",
  "gpt-6.1-sol": "sol",
  "gpt-6-astra": "astra",
};

const defaults: ReaderAiSettings = {
  model: "default",
  answerLength: "standard",
  simpleLanguage: true,
  customInstructions: "",
};
export function ReaderAiSettings({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ReaderAiSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReady(false);
    void readerAiSettingsApiService
      .get()
      .then(value => {
        if (active) {
          setSettings(value);
          setReady(true);
        }
      })
      .catch(err => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  function change(value: Partial<ReaderAiSettings>) {
    setSettings(previous => ({ ...previous, ...value }));
    setSaved(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || !ready) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      setSettings(await readerAiSettingsApiService.save(settings));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="reader-ai-settings"
      aria-label={t("reader.chat.settings.title")}
    >
      <h3>{t("reader.chat.settings.title")}</h3>
      <p>{t("reader.chat.settings.description")}</p>
      {loading && <p role="status">{t("reader.chat.settings.loading")}</p>}
      {error && (
        <div role="alert" className="reader-chat-error">
          <p>{error}</p>
          {!ready && (
            <button
              className="reader-button"
              onClick={() => setAttempt(value => value + 1)}
            >
              {t("reader.retry")}
            </button>
          )}
        </div>
      )}
      {ready && (
        <form onSubmit={event => void save(event)}>
          <fieldset disabled={saving}>
            <label htmlFor="reader-ai-model">{t("reader.chat.settings.model")}</label>
            <select
              id="reader-ai-model"
              value={settings.model ?? "default"}
              onChange={event =>
                change({ model: event.target.value as ReaderAiSettings["model"] })
              }
              aria-describedby="reader-ai-model-hint"
            >
              {readerAiModels.map(model => (
                <option key={model} value={model}>
                  {model === "default" ? t("reader.chat.settings.modelDefault") : model}
                  {" — " + t("reader.chat.settings.modelDescriptions." + modelDescriptionKeys[model])}
                </option>
              ))}
            </select>
            <p id="reader-ai-model-hint" className="reader-ai-settings-hint">
              {t("reader.chat.settings.modelHint")}
            </p>
            <label htmlFor="reader-ai-answer-length">
              {t("reader.chat.settings.length")}
            </label>
            <select
              id="reader-ai-answer-length"
              value={settings.answerLength}
              onChange={event =>
                change({
                  answerLength: event.target
                    .value as ReaderAiSettings["answerLength"],
                })
              }
            >
              <option value="short">{t("reader.chat.settings.short")}</option>
              <option value="standard">
                {t("reader.chat.settings.standard")}
              </option>
              <option value="detailed">
                {t("reader.chat.settings.detailed")}
              </option>
            </select>
            <label className="reader-ai-settings-checkbox">
              <input
                type="checkbox"
                checked={settings.simpleLanguage}
                onChange={event =>
                  change({ simpleLanguage: event.target.checked })
                }
              />
              {t("reader.chat.settings.simple")}
            </label>
            <label htmlFor="reader-ai-instructions">
              {t("reader.chat.settings.instructions")}
            </label>
            <textarea
              id="reader-ai-instructions"
              dir="auto"
              value={settings.customInstructions}
              maxLength={readerAiLimits.instructions}
              rows={7}
              placeholder={t("reader.chat.settings.example")}
              onChange={event =>
                change({ customInstructions: event.target.value })
              }
              aria-describedby="reader-ai-instructions-hint"
            />
            <p
              id="reader-ai-instructions-hint"
              className="reader-ai-settings-hint"
            >
              {t("reader.chat.settings.hint")}
            </p>
            <span className="reader-ai-settings-count">
              {settings.customInstructions.length}/{readerAiLimits.instructions}
            </span>
            <div className="reader-ai-settings-buttons">
              <button
                type="button"
                className="reader-button"
                onClick={() => {
                  setSettings({ ...defaults });
                  setSaved(false);
                }}
              >
                {t("reader.chat.settings.reset")}
              </button>
              <button type="submit" className="reader-button">
                {t(
                  saving
                    ? "reader.chat.settings.saving"
                    : "reader.chat.settings.save",
                )}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {saved && (
        <p role="status" className="reader-ai-settings-saved">
          {t("reader.chat.settings.saved")}
        </p>
      )}
      <button
        type="button"
        className="reader-button"
        disabled={saving}
        onClick={onClose}
      >
        {t("reader.chat.back")}
      </button>
    </section>
  );
}
