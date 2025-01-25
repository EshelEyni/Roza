import { FC } from "react";
import { GoBackBtn } from "../Buttons/GoBackBtn";
import { debounce } from "../../services/utilService";
import { Button } from "../Buttons/Button";
import { useTranslation } from "react-i18next";
import { DeleteEntityModal } from "../Modals/DeleteEntityModal";
import { Input } from "./Input";
import { Header } from "./Header";
import { H1 } from "./H1";
import { Hr } from "./Hr";

type PageTitleProps = {
  isEdit: boolean;
  entityType: string;
  entityName: string;
  totalWordCount?: number;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNavigateToEdit: () => void;
  modalName: string;
  onDeleteEntity: () => void;
  archiveTitle: string;
  archiveMsg: string;
  onSetReadMode?: () => void;
};

export const PageTitle: FC<PageTitleProps> = ({
  isEdit,
  entityType,
  entityName,
  totalWordCount,
  handleInputChange,
  onNavigateToEdit,
  modalName,
  onDeleteEntity,
  archiveTitle,
  archiveMsg,
  onSetReadMode,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col items-center justify-between gap-2">
      <Header>
        <h2 className="text-4xl font-bold text-app-800">{t(entityType)}</h2>
        <GoBackBtn />
      </Header>
      <Hr />
      {isEdit ? (
        <Input
          type="text"
          defaultValue={entityName}
          onChange={debounce(e => handleInputChange(e), 1500).debouncedFunc}
        />
      ) : (
        <Header addedClassName="flex-col md:flex-row ">
          <H1>
            {entityName}

            {totalWordCount && (
              <span className="ms-1 text-xl">
                ({totalWordCount} {t("words")})
              </span>
            )}
          </H1>

          <div className="flex items-center justify-between gap-2">
            {onSetReadMode && (
              <Button onClick={onSetReadMode}>
                <span>{t("readMode")}</span>
              </Button>
            )}
            <Button onClick={onNavigateToEdit}>
              <span>{t("btnEdit")}</span>
            </Button>
            <DeleteEntityModal
              modalName={modalName}
              onDeleteEntity={onDeleteEntity}
              archiveTitle={archiveTitle}
              archiveMsg={archiveMsg}
            />
          </div>
        </Header>
      )}
    </div>
  );
};
