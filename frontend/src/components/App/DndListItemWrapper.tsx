import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { debounce } from "../../services/utilService";
import classnames from "classnames";

type DndListItemWrapperProps<T extends { id: string }> = {
  item: T;
  renderItem: (item: T) => React.ReactNode;
  isCursorPointer?: boolean;
};

export const DndListItemWrapper = <T extends { id: string }>({
  item,
  renderItem,
  isCursorPointer = false,
}: DndListItemWrapperProps<T>) => {
  const [isMouseMove, setIsMouseMove] = useState(false);
  const { id } = item;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  function onMouseMove() {
    if (isMouseMove || !isCursorPointer) return;
    setIsMouseMove(true);
    debounce(() => setIsMouseMove(false), 1200).debouncedFunc();
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onMouseMove={isCursorPointer ? onMouseMove : undefined}
      className={classnames(
        "dnd-list-item-wrapper relative flex items-center justify-center",
        {
          "cursor-pointer": isCursorPointer && isMouseMove,
          "cursor-grab": !isMouseMove,
          "z-50 cursor-grabbing": isDragging,
        },
      )}
    >
      {renderItem(item)}
    </li>
  );
};
