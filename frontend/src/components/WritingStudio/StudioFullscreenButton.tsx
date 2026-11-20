import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMaximize, FiMinimize } from "react-icons/fi";

/**
 * Full-screen toggle for the studio header, matching the reader's button.
 * It uses the whole page, so studio dialogs and popovers stay visible.
 */
export function StudioFullscreenButton() {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // iPhone Safari and some embedded views cannot enter full screen.
  if (!document.fullscreenEnabled) return null;

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // The browser refused (for example, a permissions policy); the page stays as it is.
    }
  }

  return (
    <button
      type="button"
      className="ws-fullscreen"
      aria-label={t("reader.fullscreen")}
      title={t("reader.fullscreen")}
      aria-pressed={fullscreen}
      onClick={() => void toggle()}
    >
      {fullscreen ? <FiMinimize aria-hidden="true" /> : <FiMaximize aria-hidden="true" />}
    </button>
  );
}
