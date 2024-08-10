import { useEffect, useState } from "react";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { DndListItemWrapper } from "./DndListItemWrapper";

type DndListWrapperProps<T extends { id: string }> = {
  items: T[];
  renderItem: (items: T) => React.ReactNode;
  listClassName?: string;
  dragEndCallback?: (items: T[]) => void;
  isCursorPointer?: boolean;
};

export const DndListWrapper = <T,>({
  items,
  renderItem,
  dragEndCallback,
  listClassName = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
  isCursorPointer,
}: DndListWrapperProps<T & { id: string }>) => {
  const [listItems, setListItems] = useState(items);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id === over?.id) return;
    setListItems(items => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over?.id);

      const reorderedList = arrayMove(items, oldIndex, newIndex);
      dragEndCallback?.(reorderedList);
      return reorderedList;
    });
  };

  useEffect(() => {
    setListItems(items);
  }, [items]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={listItems.map(i => i.id)}
        strategy={rectSortingStrategy}
      >
        <ul className={listClassName}>
          {listItems.map(id => (
            <DndListItemWrapper<T & { id: string }>
              key={id.id}
              item={id}
              renderItem={renderItem}
              isCursorPointer={isCursorPointer ?? false}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};
