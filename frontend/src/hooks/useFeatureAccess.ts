import { canAccessFeature, type Feature } from "../../../backend/src/config/featureAccess";
import { useLoginWithToken } from "./reactQuery/get/useLoginWithToken";

export function useFeatureAccess(feature: Feature) {
  const { loggedInUser, isErrorLoggedInUser } = useLoginWithToken();
  return !isErrorLoggedInUser && canAccessFeature(feature, loggedInUser?.roles);
}
