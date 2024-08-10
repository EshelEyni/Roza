import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { debounce } from "../../services/utilService";

type DndListItemWrapperProps<T extends { id: string }> = {
  item: T;
  renderItem: (item: T) => React.ReactNode;
};

export const DndListItemWrapper = <T extends { id: string }>({
  item,
  renderItem,
}: DndListItemWrapperProps<T>) => {
  const [isCursorPointer, setIsCursorPointer] = useState(false);
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
    if (isCursorPointer) return;
    setIsCursorPointer(true);
    debounce(() => setIsCursorPointer(false), 2500).debouncedFunc();
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : isCursorPointer ? "pointer" : "grab",
  } as React.CSSProperties;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseMove={onMouseMove}
    >
      {renderItem(item)}
    </li>
  );
};
