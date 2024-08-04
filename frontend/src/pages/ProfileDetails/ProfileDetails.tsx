import { FC } from "react";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { Main } from "../../components/Gen/Main";
import { useProfile } from "../../contexts/ProfileContext";
import { ProfileDisplay } from "./ProfileDisplay";
import { ProfileEdit } from "./ProfileEdit";
import { PasswordEdit } from "./PasswordEdit";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { PageContent } from "../../components/Gen/PageContent";
import { TabBtns } from "./TabBtns";

const ProfileDetails: FC = () => {
  const { tab, setTab } = useProfile();
  const { loggedInUser } = useLoginWithToken();

  useDocumentTitle(`Roza / Profile - ${loggedInUser?.fullname || ""}`);

  if (!loggedInUser) return null;
  return (
    <Main>
      <PageContent>
        <h1 className="mt-8 text-4xl font-semibold text-app-700">
          {loggedInUser.fullname}
        </h1>

        {tab === "display" && <ProfileDisplay />}
        {tab === "edit" && <ProfileEdit />}
        {tab === "password" && <PasswordEdit />}
        <TabBtns tab={tab} setTab={setTab} />
      </PageContent>
    </Main>
  );
};

export default ProfileDetails;
