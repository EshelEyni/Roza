import { DevBoard } from "../components/DevBoard/DevBoard";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function DevBoardPage() {
  useDocumentTitle("Roza / Dev Board");
  const { loggedInUser } = useLoginWithToken();
  if (!loggedInUser) return null;
  return <DevBoard key={loggedInUser.id} account={loggedInUser.id} />;
}
