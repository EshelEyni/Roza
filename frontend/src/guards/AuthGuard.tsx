import { useLocation, useNavigate } from "react-router-dom";
import { FC, useEffect } from "react";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";

type AuthGuardProps = {
  component: React.ReactNode;
};

export const AuthGuard: FC<AuthGuardProps> = ({ component }) => {
  const { loggedInUser, isFetchedLoggedInUser } = useLoginWithToken();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Keep the full URL (e.g. ?mode=sentence) so login can return to it.
    if (!loggedInUser && isFetchedLoggedInUser)
      navigate("/home", { replace: true, state: { from: pathname + search + hash } });
  }, [loggedInUser, isFetchedLoggedInUser, navigate, pathname, search, hash]);

  return <>{component}</>;
};
