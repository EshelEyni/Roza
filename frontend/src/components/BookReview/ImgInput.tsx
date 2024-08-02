import { FC, useState } from "react";
import { useBookReview } from "../../contexts/ReviewContext";
import { Reference } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { uploadFileToCloudinary } from "../../services/cloudinary/cloudinaryService";
import { Button } from "../Buttons/Button";

type ImgInputProps = {
  reference: Reference;
};

export const ImgInput: FC<ImgInputProps> = ({ reference }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const { updateBookReviewEntity } = useBookReview();

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) return;

    setIsLoading(true);
    const url = await uploadFileToCloudinary(event.target.files[0], "image");
    setIsLoading(false);

    updateBookReviewEntity({
      type: "updateReference",
      reference: {
        ...reference,
        imgs: [...reference.imgs, url],
      },
    });
  }

  return (
    <div className="flex items-center justify-end">
      <Button disabled={isLoading}>
        <label htmlFor={`img-input-${reference.id}`} className="cursor-pointer">
          {isLoading ? (
            <span>{t("loading")}</span>
          ) : (
            <span>{t("addImage")}</span>
          )}
        </label>
      </Button>
      <input
        id={`img-input-${reference.id}`}
        type="file"
        multiple={false}
        onChange={onFileChange}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};
