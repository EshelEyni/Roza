import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMessageSquare, FiX } from "react-icons/fi";
import type { useReaderChat } from "../../hooks/useReaderChat";

type Chat = ReturnType<typeof useReaderChat>;
/** Watch in-flight requests independently of whether the chat panel is mounted. */
export function ReaderChatNotification({ chat, visible, onOpen }: { chat: Chat; visible: boolean; onOpen: (key: string) => void }) {
  const { t } = useTranslation();
  const pending = useRef(new Map<string, string>());
  const audio = useRef<AudioContext | null>(null);
  const [toast, setToast] = useState<{ key: string; id: string; title: string } | null>(null);
  useEffect(() => {
    const arm = () => {
      if (!window.AudioContext) return;
      try { audio.current ||= new AudioContext(); if (audio.current.state === "suspended") void audio.current.resume().catch(() => {}); } catch { /* Toast remains available without audio. */ }
    };
    document.addEventListener("pointerdown", arm);
    document.addEventListener("keydown", arm);
    return () => {
      document.removeEventListener("pointerdown", arm); document.removeEventListener("keydown", arm);
      void audio.current?.close().catch(() => {}); audio.current = null;
    };
  }, []);
  useEffect(() => {
    for (const tab of Object.values(chat.workspace.tabs)) {
      const request = pending.current.get(tab.key);
      if (request && tab.conversation?.turns.some(turn => turn.id === request && turn.status === "completed")) {
        pending.current.delete(tab.key);
        const viewed = visible && !chat.workspace.history && chat.workspace.groups.some(group => group.activeKey === tab.key);
        if (!viewed) {
          setToast({ key: tab.key, id: request, title: tab.title });
          const context = audio.current;
          if (context?.state === "running") {
            const oscillator = context.createOscillator(), gain = context.createGain();
            oscillator.type = "sine"; oscillator.frequency.setValueAtTime(880, context.currentTime);
            gain.gain.setValueAtTime(0, context.currentTime);
            gain.gain.linearRampToValueAtTime(.055, context.currentTime + .008);
            gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .18);
            oscillator.connect(gain); gain.connect(context.destination);
            oscillator.start(); oscillator.stop(context.currentTime + .2);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          }
        }
      }
      if (tab.pending) pending.current.set(tab.key, tab.pending.id);
    }
    for (const key of pending.current.keys()) if (!chat.workspace.tabs[key]) pending.current.delete(key);
  }, [chat.workspace, visible]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return <div className="reader-chat-ready-toast" role="status" aria-live="polite">
    <FiMessageSquare aria-hidden="true" />
    <button type="button" title={toast.title} onClick={() => { onOpen(toast.key); setToast(null); }}>{t("reader.chat.answerReady")}</button>
    <button type="button" className="reader-chat-ready-close" aria-label={t("reader.close")} onClick={() => setToast(null)}><FiX /></button>
  </div>;
}
