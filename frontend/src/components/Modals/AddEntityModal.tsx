import { FC, useRef } from "react";
import { useDebouncedValueChange } from "../../hooks/useDebouncedValueChange";
import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";
import { H3 } from "../App/H3";
import { Input } from "../App/Input";

type AddEntityModalProps = {
  title: string;
  defaultValue: string;
  placeholder: string;
  handleInputChange: (value: string) => void;
  onAddEntity: (value: string) => void;
};

export const AddEntityModal: FC<AddEntityModalProps> = ({
  title,
  defaultValue,
  placeholder,
  handleInputChange,
  onAddEntity,
}) => {
  const { t } = useTranslation();
  const latestValue = useRef(defaultValue);
  const nameChange = useDebouncedValueChange(handleInputChange);
  function add() {
    nameChange.cancel();
    onAddEntity(latestValue.current);
    latestValue.current = "";
  }
  return (
    <Modal onClose={nameChange.cancel} onOpen={() => { latestValue.current = defaultValue; }}>
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
            onChange={event => {
              latestValue.current = event.target.value;
              nameChange.schedule(event.target.value);
            }}
            className="rounded-md border border-app-800 p-2 text-center text-xl text-app-700"
            placeholder={placeholder}
            autoFocus={true}
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <Modal.CloseBtn>
              <span>{t("btnCancel")}</span>
            </Modal.CloseBtn>
            <Modal.CloseBtn onClick={add}>
              <span>{t("btnAdd")}</span>
            </Modal.CloseBtn>
          </div>
        </div>
      </Modal.Window>
    </Modal>
  );
};
