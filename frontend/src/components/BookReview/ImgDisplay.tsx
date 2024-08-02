import { FC, useState } from "react";
import { Modal } from "../Modals/Modal";
import { IoClose } from "react-icons/io5";
import { Button } from "../Buttons/Button";
import { useBookReview } from "../../contexts/ReviewContext";
import { Reference } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";

type ImgDisplayProps = {
  reference: Reference;
  img: string;
};

export const ImgDisplay: FC<ImgDisplayProps> = ({ reference, img }) => {
  const [isOpened, setIsOpened] = useState(false);
  const { updateBookReviewEntity } = useBookReview();
  const { t } = useTranslation();

  function onDeleteImg() {
    updateBookReviewEntity({
      type: "updateReference",
      reference: { ...reference, imgs: reference.imgs.filter(i => i !== img) },
    });
    setIsOpened(false);
  }

  return (
    <>
      <div className="relative">
        <Modal>
          <Modal.OpenBtn
            modalName="imgDisplay"
            className="absolute right-0 top-0 z-10 m-1 cursor-pointer rounded-full bg-app-800 p-1 text-white"
          >
            <span>
              <IoClose />
            </span>
          </Modal.OpenBtn>

          <Modal.Window name="imgDisplay">
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-2">
                <h3 className="text-center text-2xl font-medium text-app-800">
                  {t("removeImgMsg.title")}
                </h3>
                <p>{t("removeImgMsg.msg")}</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Modal.CloseBtn>
                    <span>{t("btnCancel")}</span>
                  </Modal.CloseBtn>

                  <Button onClickFn={onDeleteImg}>
                    <span>{t("btnDelete")}</span>
                  </Button>
                </div>
              </div>
            </div>
          </Modal.Window>
        </Modal>
        <img
          src={img}
          alt="book reference"
          className="h-48 w-auto cursor-pointer rounded-2xl object-fill"
          onClick={() => setIsOpened(true)}
        />
      </div>
      {isOpened && (
        <img
          src={img}
          alt="book reference"
          className="fixed left-1/2 top-1/2 z-50 h-4/5  w-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-2xl object-fill"
          onClick={() => setIsOpened(false)}
        />
      )}
    </>
  );
};
