import { useEffect } from "react";
import type { User } from "../../../shared/types/user";
import { canAccessFeature } from "../../../backend/src/config/featureAccess";
import { refreshOfflineReader } from "../services/readerApiService";
import { refreshOfflineStudio } from "../services/bookApiService";
import { offlineAccount } from "../services/offlineBooks";

export function useOfflineBooks(user?: User | null) {
  const userId = user?.id;
  const reader = canAccessFeature("reader", user?.roles);
  const studio = canAccessFeature("writingStudio", user?.roles);

  useEffect(() => {
    if (!userId || (!reader && !studio)) return;
    const controller = new AbortController();
    let active = false;

    async function refresh() {
      if (!userId || active || !navigator.onLine) return;
      active = true;
      if ((await offlineAccount())?.id !== userId || controller.signal.aborted) {
        active = false;
        return;
      }
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]);
      await Promise.allSettled([
        reader && refreshOfflineReader(userId, signal),
        studio && refreshOfflineStudio(userId, signal),
      ]);
      active = false;
    }

    void refresh();
    window.addEventListener("online", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      controller.abort();
      window.removeEventListener("online", refresh);
      window.clearInterval(interval);
    };
  }, [reader, studio, userId]);
}
