import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function ReaderProgress({
  progress,
  ready,
  onNavigate,
}: {
  progress: number;
  ready: boolean;
  onNavigate: (progress: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const pointerDown = useRef(false);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);
  const navigate = useRef(onNavigate);
  navigate.current = onNavigate;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      pointerDown.current = false;
      pending.current = null;
      setPreview(null);
      clearTimeout(timer.current);
    }
  }, [ready]);

  async function commit() {
    clearTimeout(timer.current);
    const target = pending.current;
    if (target === null) return;
    pending.current = null;
    setMoving(true);
    try {
      await navigate.current(target);
    } finally {
      if (mounted.current) {
        setMoving(false);
        setPreview(null);
      }
    }
  }

  const value = preview ?? progress;
  return (
    <div
      className="reader-progress-control"
      style={{ "--reader-progress": value * 100 + "%" } as React.CSSProperties}
    >
      <input
        className="reader-progress-slider"
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(value * 1000)}
        disabled={!ready || moving}
        aria-label={t("reader.seek")}
        aria-valuetext={t("reader.percentRead", {
          percent: Math.round(value * 100),
        })}
        title={ready ? t("reader.seek") : t("reader.preparingNavigation")}
        onPointerDown={event => {
          pointerDown.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onChange={event => {
          const target = Number(event.target.value) / 1000;
          pending.current = target;
          setPreview(target);
          clearTimeout(timer.current);
          if (!pointerDown.current)
            timer.current = setTimeout(() => void commit(), 200);
        }}
        onPointerUp={() => {
          pointerDown.current = false;
          void commit();
        }}
        onPointerCancel={() => {
          pointerDown.current = false;
          pending.current = null;
          setPreview(null);
        }}
        onKeyUp={() => void commit()}
        onBlur={() => {
          if (!pointerDown.current) void commit();
        }}
      />
      {preview !== null && (
        <span className="reader-progress-preview">
          {Math.round(value * 100)}%
        </span>
      )}
    </div>
  );
}
