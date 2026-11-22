import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FC, useEffect } from "react";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { canAccessFeature, type Feature } from "../../../backend/src/config/featureAccess";
import { Loader } from "../components/Loaders/Loader";

type AuthGuardProps = {
  feature?: Feature;
  component: React.ReactNode;
};

export const AuthGuard: FC<AuthGuardProps> = ({ component, feature }) => {
  const { loggedInUser, isFetchedLoggedInUser, isErrorLoggedInUser } = useLoginWithToken();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Keep the full URL (e.g. ?mode=sentence) so login can return to it.
    if (!loggedInUser && isFetchedLoggedInUser)
      navigate("/home", { replace: true, state: { from: pathname + search + hash } });
  }, [loggedInUser, isFetchedLoggedInUser, navigate, pathname, search, hash]);

  if (feature) {
    if (!isFetchedLoggedInUser) return <Loader isPageLoader />;
    if (!loggedInUser) return null;
    if (isErrorLoggedInUser || !canAccessFeature(feature, loggedInUser.roles))
      return <Navigate to="/home" replace />;
  }

  return <>{component}</>;
};
