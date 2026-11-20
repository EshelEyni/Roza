import { useState } from "react";
import { desktopKokoro, type KokoroStatus } from "../../../services/narration/desktopKokoro";
import { chatterboxVoices } from "../../../services/narration/kokoroVoices";
import type { KokoroAvailability } from "../../../hooks/reader/useReaderAudiobook";

const gigabytes = (bytes: number) => (bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, "");

const DEVICE_LABEL: Record<string, string> = {
  cuda: "Runs on your NVIDIA graphics card",
  mps: "Runs on your Mac's graphics",
  cpu: "No supported graphics card found: too slow to listen live. Save chapters for offline listening first",
};

/** Installs, tracks and removes the expressive voices add-on (Chatterbox Turbo) on top of the local voices. */
export function ExpressiveVoicesInstall({ status, onChanged }: { status: KokoroStatus | null | undefined; onChanged: () => void }) {
  const api = desktopKokoro();
  const addon = status?.addons?.chatterbox;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Older desktop apps have no add-ons; the add-on needs the local voices first.
  if (!api?.installAddon || !addon || !status?.installed) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); setConfirmRemove(false); }
  };

  if (!addon.supported) return <p className="audiobook-voice-help">Expressive voices are not available on this computer.</p>;

  if (addon.installing && addon.progress) {
    return <div className="audiobook-install" role="status" aria-live="polite">
      <div className="audiobook-progress-status"><span>{addon.progress.message}</span><span>{addon.progress.percent}%</span></div>
      <progress max={100} value={addon.progress.percent} aria-label="Expressive voices install progress" />
      <p className="audiobook-voice-help">You can keep listening with a standard voice meanwhile. Keep Roza open until it finishes.</p>
      <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void run(() => api.cancelAddonInstall!("chatterbox"))}>Cancel install</button>
    </div>;
  }

  if (!addon.installed) {
    return <div className="audiobook-install">
      <p className="audiobook-voice-help">
        <strong>Expressive voices</strong> (Chatterbox Turbo) read English books with more natural rhythm and emotion than the standard voices.
        {" "}{chatterboxVoices.length} voices · works offline · needs an NVIDIA graphics card with 4 GB or an Apple Silicon Mac to listen live.
        {" "}Installing downloads about 8 GB (about {gigabytes(addon.neededBytes || 10 * 1024 ** 3)} GB free space needed).
      </p>
      {(error || addon.error) && <p className="audiobook-error" role="alert">{error || addon.error}</p>}
      <button type="button" className="audiobook-voice-apply" disabled={busy} onClick={() => void run(() => api.installAddon!("chatterbox"))}>
        {busy ? "Starting…" : addon.error ? "Try again" : addon.needsUpdate ? "Update expressive voices" : "Install expressive voices"}
      </button>
    </div>;
  }

  return <div className="audiobook-install is-installed">
    {addon.device && <p className="audiobook-voice-help">Expressive voices · {DEVICE_LABEL[addon.device] || addon.device}</p>}
    {error && <p className="audiobook-error" role="alert">{error}</p>}
    {confirmRemove
      ? <p className="audiobook-voice-help">Remove expressive voices and their saved audio from this computer?{" "}
        <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void run(() => api.removeAddon!("chatterbox"))}>{busy ? "Removing…" : "Remove"}</button>{" · "}
        <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep them</button></p>
      : <button type="button" className="audiobook-link-button" onClick={() => setConfirmRemove(true)}>Remove expressive voices</button>}
  </div>;
}

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
      ? <p className="audiobook-voice-help">Remove local voices{status.addons?.chatterbox?.installed ? ", expressive voices" : ""} and every saved offline chapter from this computer?{" "}
        <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void run(() => api.remove())}>{busy ? "Removing…" : "Remove"}</button>{" · "}
        <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep them</button></p>
      : <button type="button" className="audiobook-link-button" onClick={() => setConfirmRemove(true)}>Remove local voices from this computer</button>}
  </div>;
}
