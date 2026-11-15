/** Reserve Ctrl/Cmd+S until the modifier is released, allowing an S, M chord without a save. */
export function createReaderSentenceChord({
  enabled,
  enter,
  save,
}: {
  enabled: () => boolean;
  enter: () => void;
  save: () => void;
}) {
  let modifier: "Control" | "Meta" | null = null;
  const reset = () => {
    modifier = null;
  };
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as Element | null;
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.shiftKey ||
      target?.closest?.(
        "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox],[role=slider]",
      )
    ) {
      reset();
      return false;
    }
    const key =
      event.code === "KeyS"
        ? "s"
        : event.code === "KeyM"
          ? "m"
          : event.key.toLowerCase();
    const held = modifier === "Meta" ? event.metaKey : event.ctrlKey;
    if (modifier && held && key === "m" && enabled()) {
      event.preventDefault();
      reset();
      if (!event.repeat) enter();
      return true;
    }
    if ((event.ctrlKey || event.metaKey) && key === "s" && enabled()) {
      event.preventDefault();
      modifier = event.metaKey ? "Meta" : "Control";
      return true;
    }
    if (modifier && !["s", "control", "meta"].includes(key)) reset();
    return false;
  };
  const keyup = (event: KeyboardEvent) => {
    if (!modifier) return;
    if (event.key === modifier || (!event.ctrlKey && !event.metaKey)) {
      reset();
      if (enabled()) save();
    }
  };
  return { keydown, keyup, reset };
}
