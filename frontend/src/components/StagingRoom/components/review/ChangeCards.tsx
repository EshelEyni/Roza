import type { ReviewItemChange, ReviewItemSide, ReviewPartId } from "../../../../../../shared/types/stagingRoom";
import { DiffBlocks, DiffLayout } from "./DiffBlocks";

const BADGE: Record<ReviewItemChange["change"], [string, string]> = {
  added: ["info", "Only in Staging"],
  removed: ["neutral", "Only in Writing Studio"],
  edited: ["warn", "Edited"],
};

function Side({ side, empty, tone }: { side?: ReviewItemSide; empty: string; tone: "del" | "add" }) {
  if (!side) return <div className="card-side empty">{empty}</div>;
  return (
    <div className={`card-side ${tone}`}>
      {side.quote && (
        <blockquote dir="auto" className="card-quote">
          “{side.quote}”
        </blockquote>
      )}
      {side.body && (
        <p dir="auto" className="card-body">
          {side.body}
        </p>
      )}
      {side.meta && <div className="muted small">{side.meta}</div>}
    </div>
  );
}

/** Notes and drafts that differ, one card each, Writing Studio on the left and Staging on the right. */
export function ChangeCards({
  part,
  items,
  layout,
  onReject,
  busy,
}: {
  part: ReviewPartId;
  items: ReviewItemChange[];
  layout: DiffLayout;
  onReject?: (itemId: string) => void;
  busy?: boolean;
}) {
  const word = part === "drafts" ? "draft" : "note";
  return (
    <div className="change-cards">
      {items.map((item) => (
        <article key={item.id} className="change-card" id={`card-${item.id}`}>
          <header className="change-card-head">
            <span className={`badge ${BADGE[item.change][0]}`}>{BADGE[item.change][1]}</span>
            <strong dir="auto">{item.title}</strong>
            {onReject && (
              <button className="btn-secondary sm reject-btn" disabled={busy} onClick={() => onReject(item.id)}>
                {item.change === "removed" ? `Keep · copy into Staging` : item.change === "added" ? `Reject · remove ${word}` : "Reject · keep Studio's"}
              </button>
            )}
          </header>
          {item.change === "removed" && (
            <p className="change-card-warn small">
              Staging does not have this {word}. If you push, it will be removed from Writing Studio.
            </p>
          )}
          <div className="change-card-sides">
            <Side side={item.studio} empty="Not in Writing Studio" tone="del" />
            <Side side={item.staging} empty="Not in Staging" tone="add" />
          </div>
          {item.blocks && item.blocks.some((b) => b.kind === "change") && (
            <details className="change-card-diff">
              <summary>Show the text changes in this {word}</summary>
              <DiffBlocks blocks={item.blocks} layout={layout} />
            </details>
          )}
        </article>
      ))}
    </div>
  );
}
