import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { H1 } from "../components/App/H1";
import { PageContent } from "../components/App/PageContent";
import { StagingRoomWorkspace } from "../components/StagingRoom/StagingRoomWorkspace";
import { useStagingRoomAccess } from "../hooks/useStagingRoomAccess";

export default function StagingRoomPage() {
  const { t } = useTranslation();
  const stagingRoom = useStagingRoomAccess();

  if (stagingRoom) return <StagingRoomWorkspace />;

  return (
    <PageContent>
      <H1>{t("stagingRoom.title")}</H1>
      <p>{t("stagingRoom.unavailable")}</p>
      <Link to="/home">{t("stagingRoom.back")}</Link>
    </PageContent>
  );
}
