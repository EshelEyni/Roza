import { DevBoard } from "../components/DevBoard/DevBoard";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function DevBoardPage() {
  const { loggedInUser } = useLoginWithToken();
  useDocumentTitle("Roza / Dev Board");
  if (!loggedInUser) return null;
  return <DevBoard key={loggedInUser.id} account={loggedInUser.id} />;
}
