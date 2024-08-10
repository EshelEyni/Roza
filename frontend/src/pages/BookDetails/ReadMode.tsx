import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { Button } from "../../components/Buttons/Button";
import { TextElement } from "../../components/App/TextElement";

export const ReadMode: FC = () => {
  const { book, onSetReadMode, chaptersTextElements } = useBook();

  if (!book) return null;
  return (
    <div>
      <Button onClick={onSetReadMode}>Read</Button>
      <div>
        {chaptersTextElements.map((chapter, index) => (
          <div key={index}>
            {chapter.map((el, i) => (
              <TextElement element={el} key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
