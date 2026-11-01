import { useTranslation } from "react-i18next";
const backgroundOptions = [
  ["ivory", "#fffefa"], ["sepia", "#f3e8d5"], ["charcoal", "#242622"], ["gray", "#e5e7eb"],
  ["blue", "#a3c2ff"], ["green", "#c7e4ce"], ["pink", "#f3ccd5"], ["lavender", "#d9cef2"],
];
const highlightOptions = [
  ["blue", "#719bd8"], ["sky", "#a3c2ff"], ["yellow", "#f2e66b"], ["green", "#b8dca7"],
  ["pink", "#f3b9cb"], ["lavender", "#cbb8eb"], ["peach", "#efc39e"], ["gray", "#cbd0d6"],
];
const textOptions = [
  ["black", "#28231e"], ["white", "#ffffff"], ["navy", "#183153"], ["brown", "#392e24"],
  ["blue", "#2456a6"], ["green", "#245638"], ["purple", "#663d86"], ["burgundy", "#842f45"],
];
export function ReaderColorSelect({ labelId, value, kind, onChange }: {
  labelId: string; value: string; kind: "background" | "highlight" | "text"; onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const options = kind === "background" ? backgroundOptions : kind === "text" ? textOptions : highlightOptions;
  const known = options.some(([, color]) => color.toLowerCase() === value.toLowerCase());
  return <div className="reader-color-control">
    <span className="reader-color-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
    <select aria-labelledby={labelId} value={value.toLowerCase()} onChange={event => onChange(event.target.value)}>
      {!known && <option value={value.toLowerCase()}>{t("reader.colors.saved")}</option>}
      {options.map(([name, color]) => <option key={color} value={color}>{t("reader.colors." + name)}</option>)}
    </select>
  </div>;
}
