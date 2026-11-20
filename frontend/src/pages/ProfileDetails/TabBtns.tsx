import { FC } from "react";
import { Button } from "../../components/Buttons/Button";
import { useTranslation } from "react-i18next";
import { Tab } from "../../../../shared/types/system";

type TabBtnsProps = {
  tab: string;
  setTab: React.Dispatch<React.SetStateAction<Tab>>;
};

export const TabBtns: FC<TabBtnsProps> = ({ tab, setTab }) => {
  const { t } = useTranslation();
  return (
    <div className="ui-actions-center mt-4">
      {tab !== "display" && (
        <Button onClick={() => setTab("display")}
        >
          {t("btnCancel")}
        </Button>
      )}
      <Button
        isActive={tab === "edit"}
        onClick={() => setTab("edit")}
      >
        {t("btnEdit")}
      </Button>
      <Button
        isActive={tab === "password"}
        onClick={() => setTab("password")}
      >
        {t("btnPassword")}
      </Button>
    </div>
  );
};
