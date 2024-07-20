import { FC } from "react";
import { GoBackBtn } from "./GoBackBtn";
import { debounce } from "../services/utilService";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";

type PageTitleProps = {
  isEdit: boolean;
  entityName: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNavigateToEdit: () => void;
  modalName: string;
  onDeleteEntity: () => void;
  archiveTitle: string;
  archiveMsg: string;
};

export const PageTitle: FC<PageTitleProps> = ({
  isEdit,
  entityName,
  handleInputChange,
  onNavigateToEdit,
  modalName,
  onDeleteEntity,
  archiveTitle,
  archiveMsg,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col items-center justify-between gap-4">
      <div className="flex w-full items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-app-800">{t("book")}</h2>
        <GoBackBtn />
      </div>
      {isEdit ? (
        <input
          type="text"
          defaultValue={entityName}
          className="w-full rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-3xl font-bold text-app-700"
          onChange={debounce(e => handleInputChange(e), 500).debouncedFunc}
        />
      ) : (
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="mb-4 text-4xl font-bold text-app-800">{entityName}</h1>

          <div className="flex items-center justify-between gap-2">
            <Button onClickFn={onNavigateToEdit}>
              <span>{t("btnEdit")}</span>
            </Button>

            <Modal>
              <Modal.OpenBtn modalName={modalName}>
                <div>{t("btnDelete")}</div>
              </Modal.OpenBtn>

              <Modal.Window name={modalName}>
                <div className="flex w-full flex-col gap-4">
                  <div className="flex w-full flex-col gap-2">
                    <h3 className="text-center text-2xl font-medium text-app-800">
                      {archiveTitle}
                    </h3>
                    <p>{archiveMsg}</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Modal.CloseBtn>
                        <span>{t("btnCancel")}</span>
                      </Modal.CloseBtn>

                      <Button onClickFn={onDeleteEntity}>
                        <span>{t("btnDelete")}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </Modal.Window>
            </Modal>
          </div>
        </div>
      )}
    </div>
  );
};
