import { Fragment, ReactNode } from "react";
import type { DiffBlock, DiffPara } from "../../../../../../shared/types/stagingRoom";
import { wordDiff } from "../../../WritingStudio/aiEditing";

export type DiffLayout = "split" | "unified";

/** Text with the words that differ marked. side "studio" marks removed words, "staging" marks added words. */
function Marked({ studio, staging, side }: { studio: string; staging: string; side: "studio" | "staging" }) {
  const parts = wordDiff(studio, staging);
  return (
    <>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <Fragment key={i}>{p.text}</Fragment>
        ) : (side === "studio") === (p.type === "remove") ? (
          <mark key={i} className={p.type === "remove" ? "w-del" : "w-add"}>
            {p.text}
          </mark>
        ) : null,
      )}
    </>
  );
}

function Cell({ para, kind, pair, side, numbered }: { para?: DiffPara; kind: string; pair?: DiffPara; side: "studio" | "staging"; numbered: boolean }) {
  if (!para)
    return (
      <>
        {numbered && <div className="d-num empty" />}
        <div className="d-text empty" />
      </>
    );
  return (
    <>
      {numbered && <div className={`d-num ${kind}`}>{para.n}</div>}
      <div className={`d-text ${kind}`} dir="auto">
        {pair ? (
          <Marked studio={side === "studio" ? para.text : pair.text} staging={side === "staging" ? para.text : pair.text} side={side} />
        ) : (
          para.text
        )}
      </div>
    </>
  );
}

/**
 * Side-by-side (Writing Studio left, Staging right) or inline diff.
 * Each change gets a header with its own actions.
 */
export function DiffBlocks({
  blocks,
  layout,
  numbered = true,
  headerFor,
  idPrefix,
}: {
  blocks: DiffBlock[];
  layout: DiffLayout;
  numbered?: boolean;
  /** actions shown above a change (Reject, ...) */
  headerFor?: (hunk: number) => ReactNode;
  /** element ids for jumping between changes */
  idPrefix?: string;
}) {

  return (
    <div className={`d-table ${layout} ${numbered ? "numbered" : ""}`}>
      {layout === "split" && (
        <div className="d-row d-head">
          <div className="d-side">Writing Studio · live</div>
          <div className="d-side">Staging · will be pushed</div>
        </div>
      )}
      {blocks.map((b, i) => {
        if (b.kind === "skip")
          return (
            <div key={i} className="d-skip">
              ⋯ {b.count.toLocaleString()} unchanged paragraph{b.count === 1 ? "" : "s"}
            </div>
          );
        if (b.kind === "same")
          return layout === "split" ? (
            <div key={i} className="d-row">
              <Cell para={b.studio} kind="ctx" side="studio" numbered={numbered} />
              <Cell para={b.staging} kind="ctx" side="staging" numbered={numbered} />
            </div>
          ) : (
            <div key={i} className="d-row">
              {numbered && <div className="d-num ctx">{b.staging.n}</div>}
              <div className="d-sign ctx" />
              <div className="d-text ctx" dir="auto">
                {b.staging.text}
              </div>
            </div>
          );
        const rows = Math.max(b.studio.length, b.staging.length);
        return (
          <div key={i} className="d-hunk" id={idPrefix ? `${idPrefix}-${b.hunk}` : undefined}>
            {headerFor && <div className="d-hunk-head">{headerFor(b.hunk)}</div>}
            {layout === "split"
              ? Array.from({ length: rows }, (_, r) => {
                  const studio = b.studio[r];
                  const staging = b.staging[r];
                  const paired = studio && staging;
                  return (
                    <div key={r} className="d-row">
                      <Cell para={studio} kind="del" pair={paired ? staging : undefined} side="studio" numbered={numbered} />
                      <Cell para={staging} kind="add" pair={paired ? studio : undefined} side="staging" numbered={numbered} />
                    </div>
                  );
                })
              : [
                  ...b.studio.map((p, r) => (
                    <div key={`s${r}`} className="d-row">
                      {numbered && <div className="d-num del">{p.n}</div>}
                      <div className="d-sign del">−</div>
                      <div className="d-text del" dir="auto">
                        {b.staging[r] ? <Marked studio={p.text} staging={b.staging[r].text} side="studio" /> : p.text}
                      </div>
                    </div>
                  )),
                  ...b.staging.map((p, r) => (
                    <div key={`a${r}`} className="d-row">
                      {numbered && <div className="d-num add">{p.n}</div>}
                      <div className="d-sign add">+</div>
                      <div className="d-text add" dir="auto">
                        {b.studio[r] ? <Marked studio={b.studio[r].text} staging={p.text} side="staging" /> : p.text}
                      </div>
                    </div>
                  )),
                ]}
          </div>
        );
      })}
    </div>
  );
}
