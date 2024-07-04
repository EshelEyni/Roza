import { FC } from "react";
import { useLoginWithToken } from "../../hooks/useLoginWithToken";
import { Main } from "../../components/Main";
import { useProfile } from "../../contexts/ProfileContext";
import { ProfileDisplay } from "./ProfileDisplay";
import { ProfileEdit } from "./ProfileEdit";
import { PasswordEdit } from "./PasswordEdit";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import classNames from "classnames";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const ProfileDetails: FC = () => {
  const { tab, setTab } = useProfile();
  const { loggedInUser } = useLoginWithToken();
  const { t } = useTranslation();

  useDocumentTitle(`Roza / Profile - ${loggedInUser?.fullname || ""}`);

  if (!loggedInUser) return null;
  return (
    <Main>
      <h1 className="mt-8 text-4xl font-semibold text-app-700">
        {loggedInUser.fullname}
      </h1>

      {tab === "display" && <ProfileDisplay />}
      {tab === "edit" && <ProfileEdit />}
      {tab === "password" && <PasswordEdit />}
      <div className="mt-4 flex items-center justify-center gap-4 space-x-4">
        {tab !== "display" && (
          <Button
            className="rounded-md bg-app-200 px-3 py-1"
            onClickFn={() => setTab("display")}
          >
            {t("ProfileDetails.btnCancel")}
          </Button>
        )}
        <Button
          className={classNames("rounded-md px-3 py-1", {
            "bg-app-700 text-white": tab === "edit",
            "bg-app-200": tab !== "edit",
          })}
          onClickFn={() => setTab("edit")}
        >
          {t("ProfileDetails.btnEdit")}
        </Button>
        <Button
          className={classNames("rounded-md px-3 py-1", {
            "bg-app-700 text-white": tab === "password",
            "bg-app-200": tab !== "password",
          })}
          onClickFn={() => setTab("password")}
        >
          {t("ProfileDetails.btnPassword")}
        </Button>
      </div>
    </Main>
  );
};

export default ProfileDetails;
