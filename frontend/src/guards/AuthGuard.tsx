import { useNavigate } from "react-router-dom";
import { FC, useEffect } from "react";
import { useLoginWithToken } from "../hooks/useLoginWithToken";

type AuthGuardProps = {
  component: React.ReactNode;
};

export const AuthGuard: FC<AuthGuardProps> = ({ component }) => {
  const { loggedInUser } = useLoginWithToken();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loggedInUser) navigate("/home");
  }, [loggedInUser, navigate]);

  return <>{component}</>;
};
