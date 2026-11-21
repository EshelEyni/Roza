import { Navigate } from "react-router-dom";
import { DevBoard } from "../components/DevBoard/DevBoard";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function DevBoardPage() {
  const { loggedInUser } = useLoginWithToken();
  const isAdmin = loggedInUser?.roles?.includes("admin");
  useDocumentTitle(isAdmin ? "Roza / Dev Board" : "Roza");
  if (!loggedInUser) return null;
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <DevBoard key={loggedInUser.id} account={loggedInUser.id} />;
}
