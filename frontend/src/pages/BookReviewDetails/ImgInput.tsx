import { FC, useState } from "react";
import { useBookReview } from "../../contexts/ReviewContext";
import { Reference } from "../../../../shared/types/books";

type ImgInputProps = {
  reference: Reference;
};

export const ImgInput: FC<ImgInputProps> = ({ reference }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { updateBookReviewEntity } = useBookReview();

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) return;
    setSelectedFile(event.target.files[0]);
  }

  function onFileUpload() {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);

    reader.onload = () => {
      const newReference = {
        ...reference,
        imgs: [...reference.imgs, reader.result as string],
      };
      updateBookReviewEntity({
        type: "updateReference",
        reference: newReference,
      });
    };
  }

  return (
    <div>
      <input type="file" multiple={false} onChange={onFileChange} />
      <button onClick={onFileUpload}>Upload</button>
    </div>
  );
};
