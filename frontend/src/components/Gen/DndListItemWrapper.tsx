import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

type DndListItemWrapperProps<T extends { id: string }> = {
  item: T;
  renderItem: (item: T) => React.ReactNode;
};

export const DndListItemWrapper = <T extends { id: string }>({
  item,
  renderItem,
}: DndListItemWrapperProps<T>) => {
  const [isGrabCursor, setIsGrabCursor] = useState(false);
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
    if (isGrabCursor) return;
    setIsGrabCursor(true);
    setTimeout(() => {
      setIsGrabCursor(false);
    }, 1000);
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : isGrabCursor ? "grab" : "pointer",
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
