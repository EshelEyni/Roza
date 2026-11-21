import { useEffect, useRef, useState } from "react";
import type { LogLine } from "../../../../../shared/types/stagingRoom";

export function LogPanel({ logs, onClear }: { logs: LogLine[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const last = logs[logs.length - 1];

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [logs, open]);

  return (
    <footer className={`log ${open ? "open" : ""}`}>
      <div className="log-head">
        <button className="log-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"} Activity
        </button>
        {!open && last && <span className={`log-last ${last.level}`}>{last.text}</span>}
        <button className="btn-ghost sm" onClick={onClear}>
          Clear
        </button>
      </div>
      {open && (
        <div className="log-body">
          {logs.length === 0 && <div className="log-line muted">Nothing yet.</div>}
          {logs.map((l, i) => (
            <div key={i} className={`log-line ${l.level}`}>
              <span className="time">{new Date(l.at).toLocaleTimeString()}</span>
              <span>{l.text}</span>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </footer>
  );
}
