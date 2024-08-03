import { useEffect, useState } from "react";

type UseMinimizedProps = {
  isMinimizedProp: boolean;
};

function useMinimized({ isMinimizedProp }: UseMinimizedProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    setIsMinimized(isMinimizedProp);
  }, [isMinimizedProp]);

  return { isMinimized, setIsMinimized };
}

export { useMinimized };
