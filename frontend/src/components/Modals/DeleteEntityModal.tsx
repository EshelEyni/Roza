import { FC } from "react";
import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";

type DeleteEntityModalProps = {
  modalName: string;
  onDeleteEntity: () => void;
  archiveTitle: string;
  archiveMsg: string;
};

export const DeleteEntityModal: FC<DeleteEntityModalProps> = ({
  modalName,
  onDeleteEntity,
  archiveTitle,
  archiveMsg,
}) => {
  const { t } = useTranslation();
  return (
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

              <Modal.CloseBtn onClickFn={onDeleteEntity}>
                <span>{t("btnDelete")}</span>
              </Modal.CloseBtn>
            </div>
          </div>
        </div>
      </Modal.Window>
    </Modal>
  );
};
