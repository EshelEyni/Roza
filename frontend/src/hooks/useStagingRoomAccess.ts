import { useFeatureAccess } from "./useFeatureAccess";

export function useStagingRoomAccess() {
  return useFeatureAccess("stagingRoom")
    ? window.rozaDesktop?.stagingRoom
    : undefined;
}
