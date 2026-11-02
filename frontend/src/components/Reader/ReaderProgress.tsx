import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function ReaderProgress({
  progress,
  ready,
  onNavigate,
  getDestination,
}: {
  progress: number;
  ready: boolean;
  onNavigate: (progress: number) => Promise<void>;
  getDestination?: (progress: number) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const tooltipId = useId();
  const [hover,setHover] = useState<number | null>(null);
  const [destination,setDestination] = useState<string | null>(null);
  const destinationGetter = useRef(getDestination);
  destinationGetter.current = getDestination;
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

  const target = preview ?? hover;
  useEffect(() => {
    setDestination(null);
    if (target === null || !ready || !destinationGetter.current) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      void destinationGetter.current!(target).then(label => { if (!cancelled) setDestination(label); }).catch(() => {});
    }, 100);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [target,ready,getDestination]);
  const value = preview ?? progress;
  return (
    <div
      className="reader-progress-control"
      style={{ "--reader-progress": value * 100 + "%" } as React.CSSProperties}
    >
      <input
        className="reader-progress-slider"
        type="range"
        dir="ltr"
        aria-describedby={ready && target !== null ? tooltipId : undefined}
        onPointerMove={event => {
          if (!ready) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setHover(Math.max(0,Math.min(1,(event.clientX - rect.left - 7)/(rect.width - 14))));
        }}
        onPointerLeave={() => { if (!pointerDown.current) setHover(null); }}
        onFocus={() => setHover(progress)}
        min={0}
        max={1000}
        step={1}
        value={Math.round(value * 1000)}
        disabled={!ready || moving}
        aria-label={t("reader.seek")}
        aria-valuetext={t("reader.percentRead", {
          percent: Math.round(value * 100),
        })}
        title={!ready ? t("reader.preparingNavigation") : undefined}
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
          setHover(null);
          if (!pointerDown.current) void commit();
        }}
      />
      {ready && target !== null && (
        <span id={tooltipId} role="tooltip" className="reader-progress-preview reader-progress-destination" style={{left: Math.max(5,Math.min(95,target*100))+"%"}}>
          {destination ? t("reader.destinationPage", {page:destination}) : destinationGetter.current ? t("reader.destinationLoading") : t("reader.percentRead", {percent: Math.round(target*100)})}
        </span>
      )}
    </div>
  );
}
