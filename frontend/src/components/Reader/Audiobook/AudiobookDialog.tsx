import { useEffect, useId, useRef, type ReactNode } from "react";
import { FiX } from "react-icons/fi";

/** A modal in the narrator picker's style: centered on desktop, a bottom sheet on phones. */
export function AudiobookDialog({ eyebrow, title, description, children, footer, onClose }: {
  eyebrow: string; title: string; description?: string; children: ReactNode; footer?: ReactNode; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    close.current?.focus({ preventScroll: true });
    return () => element.close();
  }, []);
  return <dialog className="audiobook-voice-modal" ref={dialog} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); onClose(); } }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="audiobook-voice-dialog">
      <header className="audiobook-voice-dialog-header">
        <div><div className="audiobook-voice-eyebrow">{eyebrow}</div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button ref={close} type="button" className="audiobook-voice-dialog-close" aria-label="Close" onClick={onClose}><FiX /></button>
      </header>
      <div className="audiobook-voice-dialog-scroll">{children}</div>
      {footer && <footer className="audiobook-voice-dialog-footer">{footer}</footer>}
    </section>
  </dialog>;
}

/** Explains why a local-voices feature can't run yet, with the one action that fixes it. */
export function LocalVoicesNeeded({ reason, onChooseVoice }: { reason: string; onChooseVoice: () => void }) {
  const text = reason === "website" ? "Saving and exporting audio use local voices, which run in the Roza desktop app."
    : reason === "not-english" ? "Local voices read English books only, so this book can't be saved or exported with them."
      : reason === "not-installed" ? "Install local voices on this computer first (in the narrator picker), then choose one."
        : "Choose a local voice (Kokoro) as this book's narrator to save or export its audio.";
  return <div className="audiobook-local-needed">
    <p>{text}</p>
    {reason !== "website" && reason !== "not-english" && <button type="button" className="audiobook-voice-apply" onClick={onChooseVoice}>Choose a narrator</button>}
  </div>;
}
