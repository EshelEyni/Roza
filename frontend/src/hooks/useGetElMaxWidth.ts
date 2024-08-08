import { useWindowSize } from "react-use";

type UseGetElMaxWidthProps = {
  width?: number;
};

function useGetElMaxWidth({ width = 1000 }: UseGetElMaxWidthProps): {
  elMaxWidth: string;
} {
  const { width: windowWidth } = useWindowSize();

  const elMaxWidth = `calc(${windowWidth < width ? windowWidth : width}px - 2.5rem)`;

  return { elMaxWidth };
}

export { useGetElMaxWidth };
