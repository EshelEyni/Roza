import { FC } from "react";
import { Button } from "../../components/Buttons/Button";
import classNames from "classnames";
import { useTranslation } from "react-i18next";
import { Tab } from "../../../../shared/types/system";

type TabBtnsProps = {
  tab: string;
  setTab: React.Dispatch<React.SetStateAction<Tab>>;
};

export const TabBtns: FC<TabBtnsProps> = ({ tab, setTab }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex items-center justify-center gap-4">
      {tab !== "display" && (
        <Button onClickFn={() => setTab("display")}>
          {t("ProfileDetails.btnCancel")}
        </Button>
      )}
      <Button
        className={classNames(
          "rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600",
          {
            "scale-115 bg-app-600 text-xl": tab === "edit",
          },
        )}
        onClickFn={() => setTab("edit")}
      >
        {t("ProfileDetails.btnEdit")}
      </Button>
      <Button
        className={classNames(
          "rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600",
          {
            "scale-115 bg-app-600 text-xl": tab === "password",
          },
        )}
        onClickFn={() => setTab("password")}
      >
        {t("ProfileDetails.btnPassword")}
      </Button>
    </div>
  );
};
