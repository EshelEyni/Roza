import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EpubRuntime } from "./useEpubRuntime";
export function useReaderFullscreen(
  runtime: EpubRuntime,
  setNotice: (message: string) => void,
) {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(false);
  const {
    shell,
    fullscreenResizeAnchor,
    stateRef,
    changingLayout,
    layoutVersion,
  } = runtime;
  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, [shell]);

  async function toggleFullscreen() {
    // Capture before fullscreen changes the available reading area.
    if (!shell.current || changingLayout.current) return;
    const version = ++layoutVersion.current;
    fullscreenResizeAnchor.current = stateRef.current.location;
    changingLayout.current = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      if (version === layoutVersion.current) {
        fullscreenResizeAnchor.current = null;
        changingLayout.current = false;
      }
      setNotice(t("reader.fullscreenError"));
    }
  }

  return { fullscreen, toggleFullscreen };
}
