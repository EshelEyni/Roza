import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EpubRuntime } from "./useEpubRuntime";
export function useReaderFullscreen(
  runtime: EpubRuntime,
  setNotice: (message: string) => void,
) {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(false);
  const { shell, fullscreenResizeAnchor, stateRef } = runtime;
  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, [shell]);

  async function toggleFullscreen() {
    // Capture before fullscreen changes the available reading area.
    fullscreenResizeAnchor.current = stateRef.current.location;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      setNotice(t("reader.fullscreenError"));
    }
  }

  return { fullscreen, toggleFullscreen };
}
