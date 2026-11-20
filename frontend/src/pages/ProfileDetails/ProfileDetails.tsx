import { FC } from "react";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { Main } from "../../components/App/Main";
import { useProfile } from "../../contexts/ProfileContext";
import { ProfileDisplay } from "./ProfileDisplay";
import { ProfileEdit } from "./ProfileEdit";
import { PasswordEdit } from "./PasswordEdit";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { PageContent } from "../../components/App/PageContent";
import { TabBtns } from "./TabBtns";
import { H1 } from "../../components/App/H1";
import { Button } from "../../components/Buttons/Button";
import { useLogout } from "../../hooks/reactQuery/update/useLogout";
import { useTranslation } from "react-i18next";

const ProfileDetails: FC = () => {
  const { tab, setTab } = useProfile();
  const { loggedInUser } = useLoginWithToken();
  const { logout } = useLogout();
  const { t } = useTranslation();

  useDocumentTitle(`Roza / Profile - ${loggedInUser?.fullname || ""}`);

  if (!loggedInUser) return null;
  return (
    <Main>
      <PageContent>
        <div className="ui-entry-head">
          <H1>{loggedInUser.fullname}</H1>
          <Button onClick={() => logout()}>{t("btnLogout")}</Button>
        </div>

        {tab === "display" && <ProfileDisplay />}
        {tab === "edit" && <ProfileEdit />}
        {tab === "password" && <PasswordEdit />}
        <TabBtns tab={tab} setTab={setTab} />
      </PageContent>
    </Main>
  );
};

export default ProfileDetails;
