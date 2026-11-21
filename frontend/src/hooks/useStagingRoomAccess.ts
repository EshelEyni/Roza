import { useLoginWithToken } from "./reactQuery/get/useLoginWithToken";

export function useStagingRoomAccess() {
  const { loggedInUser } = useLoginWithToken();

  return loggedInUser?.roles?.includes("admin")
    ? window.rozaDesktop?.stagingRoom
    : undefined;
}
