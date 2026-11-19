import { useState } from "react";
import { desktopKokoro, type KokoroStatus } from "../../../services/narration/desktopKokoro";
import type { KokoroAvailability } from "../../../hooks/reader/useReaderAudiobook";

const gigabytes = (bytes: number) => (bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, "");

/** Installs, tracks and removes local voices (the Kokoro runtime) on this computer. */
export function KokoroInstall({ status, availability, onChanged }: {
  status: KokoroStatus | null | undefined; availability: KokoroAvailability; onChanged: () => void;
}) {
  const api = desktopKokoro();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!api || !status || availability === "website" || availability === "checking") return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); setConfirmRemove(false); }
  };

  if (status.installing && status.progress) {
    return <div className="audiobook-install" role="status" aria-live="polite">
      <div className="audiobook-progress-status"><span>{status.progress.message}</span><span>{status.progress.percent}%</span></div>
      <progress max={100} value={status.progress.percent} aria-label="Local voices install progress" />
      <p className="audiobook-voice-help">You can keep reading with another voice meanwhile. Keep Roza open until it finishes.</p>
      <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void run(() => api.cancelInstall())}>Cancel install</button>
    </div>;
  }

  if (!status.installed) {
    return <div className="audiobook-install">
      <p className="audiobook-voice-help">
        {status.needsUpdate ? "Local voices need a quick update for this version of Roza." : "Local voices use Kokoro, a speech model that runs on this computer: free, private, with exact word timing, and it works offline."}
        {" "}Installing downloads Python, the speech engine, the voice model and all 28 English voices (about {gigabytes(status.neededBytes || 3 * 1024 ** 3)} GB free space needed). It takes a few minutes.
      </p>
      {(error || status.error) && <p className="audiobook-error" role="alert">{error || status.error}</p>}
      <button type="button" className="audiobook-voice-apply" disabled={busy} onClick={() => void run(() => api.install())}>
        {busy ? "Starting…" : status.error ? "Try again" : status.needsUpdate ? "Update local voices" : "Install local voices"}
      </button>
    </div>;
  }

  return <div className="audiobook-install is-installed">
    {error && <p className="audiobook-error" role="alert">{error}</p>}
    {confirmRemove
      ? <p className="audiobook-voice-help">Remove local voices and every saved offline chapter from this computer?{" "}
        <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void run(() => api.remove())}>{busy ? "Removing…" : "Remove"}</button>{" · "}
        <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep them</button></p>
      : <button type="button" className="audiobook-link-button" onClick={() => setConfirmRemove(true)}>Remove local voices from this computer</button>}
  </div>;
}
