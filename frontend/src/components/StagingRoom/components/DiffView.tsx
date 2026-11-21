import type { DiffLine } from "../../../../../shared/types/stagingRoom";

/** Git-style view of what differs between the local file and Roza. */
export function DiffView({ diff }: { diff?: DiffLine[] }) {
  if (!diff || !diff.length) return <div className="diff muted small">No visible differences (spacing only).</div>;
  const local = diff.filter((d) => d.kind === "local").length;
  const roza = diff.filter((d) => d.kind === "roza").length;
  return (
    <div className="diff">
      <div className="diff-legend small">
        <span className="diff-key local">Local only · {local}</span>
        <span className="diff-key roza">Roza only · {roza}</span>
      </div>
      {diff.map((d, i) =>
        d.kind === "skip" ? (
          <div key={i} className="diff-line skip">
            ⋯ {d.count} unchanged paragraph{d.count === 1 ? "" : "s"} ⋯
          </div>
        ) : (
          <div key={i} className={`diff-line ${d.kind}`} dir="auto">
            <span className="diff-sign">{d.kind === "local" ? "L" : d.kind === "roza" ? "R" : ""}</span>
            <span>{d.text}</span>
          </div>
        ),
      )}
    </div>
  );
}
