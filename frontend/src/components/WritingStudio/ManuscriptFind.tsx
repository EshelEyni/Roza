import { useEffect, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp, FiMove, FiX } from "react-icons/fi";
import { Editor, Element, Node, Range } from "slate";
import { findTextMatches, type ManuscriptFindOptions } from "./manuscriptFindText";

export type { ManuscriptFindOptions } from "./manuscriptFindText";

export function findManuscriptMatches(editor: Editor, query: string, options: ManuscriptFindOptions) {
  const highlights = new Map<string, (Range & { findMatch: number })[]>();
  let count = 0;
  if (!query) return { highlights, count };

  for (const [block, blockPath] of Editor.nodes(editor, {
    at: [],
    mode: "lowest",
    match: node => Element.isElement(node) && Editor.isBlock(editor, node),
  })) {
    let length = 0;
    const leaves = Array.from(Node.texts(block), ([leaf, path]) => {
      const start = length;
      length += leaf.text.length;
      return { path: blockPath.concat(path), start, end: length };
    });
    let firstLeaf = 0;
    for (const { start, end } of findTextMatches([Node.string(block)], query, options)) {
      while (leaves[firstLeaf].end <= start) firstLeaf++;
      for (let index = firstLeaf; index < leaves.length && leaves[index].start < end; index++) {
        const leaf = leaves[index];
        if (leaf.start === leaf.end) continue;
        const key = leaf.path.join(".");
        const ranges = highlights.get(key) ?? [];
        ranges.push({
          anchor: { path: leaf.path, offset: Math.max(start, leaf.start) - leaf.start },
          focus: { path: leaf.path, offset: Math.min(end, leaf.end) - leaf.start },
          findMatch: count,
        });
        highlights.set(key, ranges);
      }
      count++;
    }
  }
  return { highlights, count };
}

export function ManuscriptFind({
  query, count, current, options, onQuery, onOptions, onStep, onClose, focusRequest,
}: {
  query: string;
  count: number;
  current: number;
  options: ManuscriptFindOptions;
  onQuery: (query: string) => void;
  onOptions: (options: ManuscriptFindOptions) => void;
  onStep: (direction: number) => void;
  onClose: () => void;
  focusRequest: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number }>();
  const [position, setPosition] = useState<{ left: number; top: number }>();

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, [focusRequest]);

  useEffect(() => {
    const resize = () => {
      const bounds = panel.current?.getBoundingClientRect();
      if (!bounds) return;
      setPosition(previous => previous && ({
        left: Math.max(8, Math.min(previous.left, window.innerWidth - bounds.width - 8)),
        top: Math.max(8, Math.min(previous.top, window.innerHeight - bounds.height - 8)),
      }));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div
      ref={panel}
      className="ws-manuscript-find"
      data-ws-find
      role="search"
      aria-label="Find in manuscript"
      dir="ltr"
      style={position ? { ...position, right: "auto" } : undefined}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <span
        className="ws-manuscript-find-grip"
        title="Drag to move search"
        aria-hidden="true"
        onPointerDown={event => {
          if (event.button !== 0 || !panel.current) return;
          event.preventDefault();
          const bounds = panel.current.getBoundingClientRect();
          drag.current = { pointer: event.pointerId, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const active = drag.current;
          if (active?.pointer !== event.pointerId || !panel.current) return;
          const { width, height } = panel.current.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(event.clientX - active.x, window.innerWidth - width - 8)),
            top: Math.max(8, Math.min(event.clientY - active.y, window.innerHeight - height - 8)),
          });
        }}
        onLostPointerCapture={() => { drag.current = undefined; }}
      >
        <FiMove />
      </span>
      <div className="ws-manuscript-find-field">
        <input
          ref={input}
          type="text"
          placeholder="Find"
          aria-label="Find text"
          value={query}
          onChange={event => onQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            onStep(event.shiftKey ? -1 : 1);
          }}
        />
        <button type="button" title="Match Case" aria-label="Match Case" aria-pressed={options.matchCase}
          onClick={() => onOptions({ ...options, matchCase: !options.matchCase })}>
          Aa
        </button>
        <button type="button" title="Match Whole Word" aria-label="Match Whole Word" aria-pressed={options.wholeWord}
          className="ws-manuscript-find-word"
          onClick={() => onOptions({ ...options, wholeWord: !options.wholeWord })}>
          ab
        </button>
      </div>
      <span className="ws-manuscript-find-count" role="status">
        {query && (count ? `${current + 1} of ${count}` : "No results")}
      </span>
      <button type="button" title="Previous match (Shift+Enter)" aria-label="Previous match" disabled={!count} onClick={() => onStep(-1)}><FiArrowUp /></button>
      <button type="button" title="Next match (Enter)" aria-label="Next match" disabled={!count} onClick={() => onStep(1)}><FiArrowDown /></button>
      <button type="button" title="Close find (Escape)" aria-label="Close find" onClick={onClose}><FiX /></button>
    </div>
  );
}
