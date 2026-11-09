import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog, ConfirmationOptions } from "./ConfirmDialog";
export function useConfirmation() {
  const [request, setRequest] = useState<ConfirmationOptions | null>(null);
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(
    () => () => {
      resolve.current?.(false);
      resolve.current = null;
    },
    [],
  );
  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>(done => {
        resolve.current?.(false);
        resolve.current = done;
        setRequest(options);
      }),
    [],
  );
  const settle = (value: boolean) => {
    const done = resolve.current;
    resolve.current = null;
    setRequest(null);
    done?.(value);
  };
  return {
    confirm,
    confirmationDialog: request ? (
      <ConfirmDialog
        {...request}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    ) : null,
  };
}
