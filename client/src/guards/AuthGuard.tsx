import { useNavigate } from "react-router-dom";
import { FC, useEffect } from "react";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";

type AuthGuardProps = {
  component: React.ReactNode;
};

export const AuthGuard: FC<AuthGuardProps> = ({ component }) => {
  const { loggedInUser, isFetchedLoggedInUser } = useLoginWithToken();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loggedInUser && isFetchedLoggedInUser) navigate("/home");
  }, [loggedInUser, isFetchedLoggedInUser, navigate]);

  return <>{component}</>;
};
