import { FiMinus, FiPlus } from "react-icons/fi";
import { ReaderSelect } from "./ReaderSelect";
import { useId, useState } from "react";
import type { ReaderKeyboardSettings } from "../../../../shared/types/readerKeyboardSettings";
import { ReaderColorSelect } from "./ReaderColorSelect";
import { useTranslation } from "react-i18next";
import { ReaderPreferences } from "../../../../shared/types/reader";

type ReaderSettingsProps = {
  keyboardSettings?: ReaderKeyboardSettings;
  onKeyboardChange?: (settings: ReaderKeyboardSettings) => void;
  keyboardSaveStatus?: "loading" | "saving" | "saved" | "error";
  onKeyboardRetry?: () => void;
  preferences: ReaderPreferences;
  onChange: (preferences: ReaderPreferences) => void;
  publisherPagesAvailable: boolean | null;
};

export function ReaderSettings({
  keyboardSettings,
  onKeyboardChange,
  keyboardSaveStatus,
  onKeyboardRetry,
  preferences,
  onChange,
  publisherPagesAvailable,
}: ReaderSettingsProps) {
  const { t } = useTranslation();
  const keyboardId = useId();
  const [countDraft, setCountDraft] = useState<string | null>(null);
  function update(changes: Partial<ReaderPreferences>) {
    onChange({ ...preferences, ...changes });
  }
  const defaults = {
    backgroundColor: { light: "#fffefa", sepia: "#f3e8d5", dark: "#242622" }[preferences.theme],
    selectionColor: "#719bd8", selectionTextColor: { light: "#28231e", sepia: "#392e24", dark: "#ffffff" }[preferences.theme],
    passageColor: "#f2e66b", passageTextColor: "#28231e",
    translationColor: "#a3c2ff", translationTextColor: "#28231e",
  };
  function colorRow(key: keyof typeof defaults) {
    return <div className="reader-color-row" key={key}>
      <span id={"reader-color-" + key}>{t("reader." + key)}</span>
      <ReaderColorSelect labelId={"reader-color-" + key}
        kind={key === "backgroundColor" ? "background" : key.endsWith("TextColor") ? "text" : "highlight"}
        value={preferences[key] || defaults[key]} onChange={color => update({ [key]: color })} />
    </div>;
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
      <label>
        {t("reader.pageNumbering")}
        <select
          value={preferences.pageNumbering || "screen"}
          aria-describedby="reader-page-numbering-hint"
          onChange={event =>
            update({
              pageNumbering: event.target
                .value as ReaderPreferences["pageNumbering"],
            })
          }
        >
          <option value="screen">{t("reader.screenPages")}</option>
          <option value="publisher" disabled={publisherPagesAvailable !== true}>
            {t("reader.publisherPages")}
          </option>
        </select>
      </label>
      <p id="reader-page-numbering-hint" className="reader-hint" role="status">
        {t(
          publisherPagesAvailable === null
            ? "reader.preparingBookPages"
            : publisherPagesAvailable
              ? "reader.pageNumberingHint"
              : "reader.noBookPages",
        )}
      </p>
      {keyboardSettings && onKeyboardChange && <fieldset className="reader-mark-color-group reader-keyboard-settings">
        <legend>{t("reader.keyboard.title")}</legend>
        <div className="reader-keyboard-field">
          <label id={keyboardId + "-unit-label"} htmlFor={keyboardId + "-unit"}>{t("reader.keyboard.unit")}</label>
          <ReaderSelect id={keyboardId + "-unit"} labelId={keyboardId + "-unit-label"} value={keyboardSettings.unit}
            options={[{ value: "words", label: t("reader.keyboard.words") }, { value: "sentences", label: t("reader.keyboard.sentences") }]}
            onChange={unit => onKeyboardChange({ ...keyboardSettings, unit })} />
        </div>
        <div className="reader-keyboard-field">
          <label htmlFor={keyboardId + "-count"}>{t("reader.keyboard.count")}</label>
          <div className="reader-number-control">
            <button type="button" className="reader-icon-button" aria-label={t("reader.keyboard.decrease")} disabled={keyboardSettings.count <= 1}
              onClick={() => { setCountDraft(null); onKeyboardChange({ ...keyboardSettings, count: keyboardSettings.count - 1 }); }}><FiMinus aria-hidden="true" /></button>
            <input id={keyboardId + "-count"} type="number" inputMode="numeric" min={1} step={1} value={countDraft ?? keyboardSettings.count}
              onChange={event => { setCountDraft(event.target.value); const count = Number(event.target.value); if (Number.isSafeInteger(count) && count >= 1) onKeyboardChange({ ...keyboardSettings, count }); }}
              onBlur={() => setCountDraft(null)} />
            <button type="button" className="reader-icon-button" aria-label={t("reader.keyboard.increase")} disabled={keyboardSettings.count >= Number.MAX_SAFE_INTEGER}
              onClick={() => { setCountDraft(null); onKeyboardChange({ ...keyboardSettings, count: keyboardSettings.count + 1 }); }}><FiPlus aria-hidden="true" /></button>
          </div>
        </div>
        <p className="reader-hint">{t("reader.keyboard.hint")}</p>
        <p role="status" className="reader-hint">{t("reader.keyboard." + (keyboardSaveStatus || "saved"))}
          {keyboardSaveStatus === "error" && <button type="button" className="reader-button" onClick={onKeyboardRetry}>{t("reader.retry")}</button>}
        </p>
      </fieldset>}
      <div className="reader-color-settings">
        {colorRow("backgroundColor")}
        {([
          ["selectedTextColors", "selectionColor", "selectionTextColor"],
          ["passageColors", "passageColor", "passageTextColor"],
          ["translationColors", "translationColor", "translationTextColor"],
        ] as const).map(([title, background, text]) => <fieldset className="reader-mark-color-group" key={title}>
          <legend>{t("reader." + title)}</legend>
          {colorRow(background)}
          {colorRow(text)}
          <p className="reader-color-preview" style={{background: preferences[background] || defaults[background], color: preferences[text] || defaults[text]}}>{t("reader.colorPreview")}</p>
        </fieldset>)}
      <button type="button" className="reader-colors-reset" onClick={() => update({
        backgroundColor: undefined, selectionColor: undefined, selectionTextColor: undefined,
        passageColor: undefined, passageTextColor: undefined, translationColor: undefined, translationTextColor: undefined,
      })}>{t("reader.resetColors")}</button>
      </div>
    </section>
  );
}
