import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FiCheck, FiChevronDown, FiX } from "react-icons/fi";
import "./readerColorSelect.css";

type ColorOption = readonly [name: string, color: string];

const warmOptions: ColorOption[] = [["sand", "#e7d8bd"], ["oat", "#d8c3a5"], ["caramel", "#b88a60"], ["walnut", "#6b4f3a"]];
const backgroundOptions: ColorOption[] = [
  ["ivory", "#fffefa"], ["cream", "#fbf6ed"], ["linen", "#f5ede0"], ["sepia", "#f3e8d5"],
  ["parchment", "#efe3cc"], ["latte", "#e3cdb0"], ["sage", "#dfe5d3"], ["gray", "#e5e7eb"],
  ["blue", "#a3c2ff"], ["green", "#c7e4ce"], ["pink", "#f3ccd5"], ["lavender", "#d9cef2"],
  ["charcoal", "#242622"], ["slate", "#2f3438"], ["espresso", "#2e241c"],
  ...warmOptions,
];
const highlightOptions: ColorOption[] = [
  ["blue", "#719bd8"], ["sky", "#a3c2ff"], ["dustyBlue", "#b3c4d6"], ["yellow", "#f2e66b"],
  ["honey", "#e9c46a"], ["amber", "#e0a458"], ["peach", "#efc39e"], ["terracotta", "#d38b6b"],
  ["rose", "#e6b3aa"], ["pink", "#f3b9cb"], ["lavender", "#cbb8eb"], ["green", "#b8dca7"],
  ["sage", "#c5d2b4"], ["olive", "#b5b07a"], ["parchment", "#efe3cc"], ["latte", "#e3cdb0"],
  ["clay", "#c9a68b"], ["gray", "#cbd0d6"],
  ...warmOptions,
];
const textOptions: ColorOption[] = [
  ["black", "#28231e"], ["white", "#ffffff"], ["brown", "#392e24"], ["espresso", "#2e241c"],
  ["cocoa", "#5a4030"], ["rust", "#9a4a2a"], ["burgundy", "#842f45"], ["plum", "#5b3a5e"],
  ["purple", "#663d86"], ["ink", "#1f2a44"], ["navy", "#183153"], ["blue", "#2456a6"],
  ["slate", "#3d4650"], ["forest", "#2f4a32"], ["green", "#245638"], ["moss", "#4f5a2e"],
  ...warmOptions,
];

export function ReaderColorSelect({ labelId, label, value, kind, onChange }: {
  labelId: string; label: string; value: string; kind: "background" | "highlight" | "text"; onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const valueId = useId();
  const options = kind === "background" ? backgroundOptions : kind === "text" ? textOptions : highlightOptions;
  const current = options.find(([, color]) => color.toLowerCase() === value.toLowerCase());
  const name = current ? t("reader.colors." + current[0]) : t("reader.colors.saved");
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return <div className="reader-color-control">
    <button type="button" ref={trigger} className="reader-color-trigger" aria-haspopup="dialog"
      aria-labelledby={labelId + " " + valueId} onClick={() => setOpen(true)}>
      <span className="reader-color-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
      <span id={valueId} className="reader-color-name">{name}</span>
      <FiChevronDown aria-hidden="true" />
    </button>
    {open && <ReaderColorDialog label={label} value={value} options={options}
      onClose={close} onPick={color => { onChange(color); close(); }} />}
  </div>;
}

function ReaderColorDialog({ label, value, options, onClose, onPick }: {
  label: string; value: string; options: ColorOption[]; onClose: () => void; onPick: (color: string) => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const known = options.some(([, color]) => color.toLowerCase() === value.toLowerCase());
  const tiles: ColorOption[] = known ? options : [["saved", value], ...options];
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLButtonElement>(".reader-color-tile[aria-pressed=true]")?.focus();
    return () => element.close();
  }, []);
  return createPortal(
    <dialog className="reader-archive-dialog reader-color-dialog" ref={dialog} aria-labelledby={headingId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
      <div className="reader-color-dialog-content">
        <header className="reader-color-dialog-header">
          <h2 id={headingId}>{label}</h2>
          <button type="button" className="reader-color-dialog-close" aria-label={t("reader.colors.close")} onClick={onClose}>
            <FiX aria-hidden="true" />
          </button>
        </header>
        <div className="reader-color-grid">
          {tiles.map(([name, color]) => {
            const active = color.toLowerCase() === value.toLowerCase();
            return <button type="button" key={name + color} className="reader-color-tile" aria-pressed={active}
              onClick={() => onPick(color.toLowerCase())}>
              <span className="reader-color-tile-swatch" style={{ backgroundColor: color }} aria-hidden="true">
                {active && <FiCheck style={{ color: contrast(color) }} />}
              </span>
              <span className="reader-color-tile-name">{t("reader.colors." + name)}</span>
            </button>;
          })}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function contrast(color: string) {
  const [red, green, blue] = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16) || 0);
  return red * 0.299 + green * 0.587 + blue * 0.114 < 140 ? "#ffffff" : "#28231e";
}
