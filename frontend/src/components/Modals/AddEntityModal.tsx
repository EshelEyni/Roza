import { FC } from "react";
import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";
import { H3 } from "../App/H3";
import { Input } from "../App/Input";

type AddEntityModalProps = {
  title: string;
  defaultValue: string;
  placeholder: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddEntity: () => void;
};

export const AddEntityModal: FC<AddEntityModalProps> = ({
  title,
  defaultValue,
  placeholder,
  handleInputChange,
  onAddEntity,
}) => {
  const { t } = useTranslation();
  return (
    <Modal>
      <Modal.OpenBtn modalName="addBook">
        <div>{title}</div>
      </Modal.OpenBtn>

      <Modal.Window name="addBook">
        <div className="flex w-full flex-col gap-2">
          <H3 addedClassName="text-center">{title}</H3>

          <Input
            type="text"
            name="name"
            defaultValue={defaultValue}
            onChange={handleInputChange}
            className="rounded-md border border-app-800 p-2 text-center text-xl text-app-700"
            placeholder={placeholder}
            autoFocus={true}
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <Modal.CloseBtn>
              <span>{t("btnCancel")}</span>
            </Modal.CloseBtn>
            <Modal.CloseBtn onClick={onAddEntity}>
              <span>{t("btnAdd")}</span>
            </Modal.CloseBtn>
          </div>
        </div>
      </Modal.Window>
    </Modal>
  );
};
