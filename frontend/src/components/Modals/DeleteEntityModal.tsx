import { FC } from "react";
import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";
import { H3 } from "../App/H3";
import { P } from "../App/P";

type DeleteEntityModalProps = {
  modalName: string;
  onDeleteEntity: () => void;
  archiveTitle: string;
  archiveMsg: string;
  isSmallOpenBtn?: boolean;
};

export const DeleteEntityModal: FC<DeleteEntityModalProps> = ({
  modalName,
  onDeleteEntity,
  archiveTitle,
  archiveMsg,
  isSmallOpenBtn,
}) => {
  const { t } = useTranslation();
  return (
    <Modal>
      <Modal.OpenBtn modalName={modalName} isSmall={isSmallOpenBtn}>
        <span>{t("btnDelete")}</span>
      </Modal.OpenBtn>

      <Modal.Window name={modalName}>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col gap-2">
            <H3 addedClassName="text-center">{archiveTitle}</H3>
            <P addedClassName="text-center">{archiveMsg}</P>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Modal.CloseBtn>
                <span>{t("btnCancel")}</span>
              </Modal.CloseBtn>

              <Modal.CloseBtn onClick={onDeleteEntity}>
                <span>{t("btnDelete")}</span>
              </Modal.CloseBtn>
            </div>
          </div>
        </div>
      </Modal.Window>
    </Modal>
  );
};
