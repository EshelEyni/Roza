import { useTranslation } from "react-i18next";
import { ReaderPreferences } from "../../../../shared/types/reader";

type ReaderSettingsProps = {
  preferences: ReaderPreferences;
  onChange: (preferences: ReaderPreferences) => void;
};

export function ReaderSettings({ preferences, onChange }: ReaderSettingsProps) {
  const { t } = useTranslation();
  function update(changes: Partial<ReaderPreferences>) {
    onChange({ ...preferences, ...changes });
  }
  return (
    <section className="reader-settings" aria-label={t("reader.settings")}>
      <h2>{t("reader.settings")}</h2>
      <label>
        {t("reader.fontSize")} <span>{preferences.fontSize}px</span>
        <input
          type="range"
          min={14}
          max={36}
          step={1}
          value={preferences.fontSize}
          onChange={event => update({ fontSize: Number(event.target.value) })}
        />
      </label>
      <label>
        {t("reader.font")}
        <select
          value={preferences.fontFamily}
          onChange={event =>
            update({
              fontFamily: event.target.value as ReaderPreferences["fontFamily"],
            })
          }
        >
          <option value="serif">{t("reader.serif")}</option>
          <option value="sans-serif">{t("reader.sansSerif")}</option>
        </select>
      </label>
      <label>
        {t("reader.lineSpacing")}
        <input
          type="range"
          min={1.2}
          max={2.4}
          step={0.1}
          value={preferences.lineHeight}
          onChange={event => update({ lineHeight: Number(event.target.value) })}
        />
      </label>
      <label>
        {t("reader.width")}
        <select
          value={preferences.width}
          onChange={event =>
            update({ width: event.target.value as ReaderPreferences["width"] })
          }
        >
          <option value="comfortable">{t("reader.comfortable")}</option>
          <option value="wide">{t("reader.wide")}</option>
        </select>
      </label>
      <label>
        {t("reader.theme")}
        <select
          value={preferences.theme}
          onChange={event =>
            update({ theme: event.target.value as ReaderPreferences["theme"] })
          }
        >
          <option value="light">{t("reader.light")}</option>
          <option value="sepia">{t("reader.sepia")}</option>
          <option value="dark">{t("reader.dark")}</option>
        </select>
      </label>
      <label>
        {t("reader.navigation")}
        <select
          value={preferences.flow}
          onChange={event =>
            update({ flow: event.target.value as ReaderPreferences["flow"] })
          }
        >
          <option value="paginated">{t("reader.pages")}</option>
          <option value="scrolled">{t("reader.scroll")}</option>
        </select>
      </label>
    </section>
  );
}
