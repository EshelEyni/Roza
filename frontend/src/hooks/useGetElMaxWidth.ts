import { useWindowSize } from "react-use";

type UseGetElMaxWidthProps = {
  width?: number;
};

function useGetElMaxWidth({ width = 1000 }: UseGetElMaxWidthProps): {
  elMaxWidth: string;
} {
  const { width: windowWidth } = useWindowSize();

  const elMaxWidth =
    windowWidth < width
      ? `max-w-[calc(${windowWidth}px-2.5rem)]`
      : `max-w-[calc(${width}px-2.5rem)]`;

  return { elMaxWidth };
}

export { useGetElMaxWidth };
