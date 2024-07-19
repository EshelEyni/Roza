/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  FC,
  useState,
  createContext,
  useContext,
  cloneElement,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { debounce } from "../services/utilService";
import { MainScreen } from "./MainScreen";

type ModalPosition = {
  top?: number;
  bottom?: number;
  left?: number;
};

type ModalProps = {
  children: React.ReactNode;
  externalStateControl?: {
    openedModalName: string;
    setOpenedModalName: React.Dispatch<React.SetStateAction<string>>;
  };
  onOpen?: () => void;
  onClose?: () => void;
  onAfterClose?: () => void;
};

type OpenBtnProps = {
  children: React.ReactElement;
  modalName: string;
  className?: string;
  setPositionByRef?: boolean;
  modalHeight?: number;
  externalControlFunc?: () => void;
};

type CloseBtnProps = {
  children: React.ReactElement;
  className?: string;
  onClickFn?: () => void;
};

type ModalHoverActivatorProps = {
  children: React.ReactNode;
  modalName: string;
  modalHeight?: number;
};

type WindowProps = {
  children: React.ReactNode;
  name: string;
  className?: string;
  style?: React.CSSProperties;
  elementId?: string;
  hoverControl?: boolean;
};

type ModalContextType = {
  openedModalName: string;
  close: () => void;
  open: (name: string) => void;
  position: ModalPosition | null;
  setPosition: React.Dispatch<React.SetStateAction<ModalPosition | null>>;
  isModalAbove: boolean;
  setIsModalAbove: React.Dispatch<React.SetStateAction<boolean>>;
  modalHoverGuardZone: ModalHoverGuardZone | null;
  setModalHoverGuardZone: React.Dispatch<
    React.SetStateAction<ModalHoverGuardZone | null>
  >;
  debouncedClose: () => void;
  cancelDebouncedClose: () => void;
};

type ModalHoverGuardZone = {
  height: number;
  width: number;
};

function calculatePositionByRef<T extends HTMLElement>(
  ref: React.RefObject<T>,
  modalHeight: number,
) {
  const rect = ref.current?.getBoundingClientRect();
  if (!rect) return;
  const windowHeight = window.innerHeight;
  const isModalPositionUp = windowHeight - rect.top < modalHeight;
  const bottomPosition = {
    top: rect.bottom + rect.height / 2 + window.scrollY,
  };
  const topPosition = {
    bottom: window.innerHeight - rect.top + rect.height / 2,
  };
  return {
    isModalAbove: isModalPositionUp,
    position: {
      ...(isModalPositionUp ? topPosition : bottomPosition),
      left: rect.left + rect.width / 2 + window.scrollX,
    },
    rect,
  };
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const Modal: FC<ModalProps> & {
  OpenBtn: FC<OpenBtnProps>;
  Window: FC<WindowProps>;
  CloseBtn: FC<CloseBtnProps>;
  ModalHoverOpen: FC<ModalHoverActivatorProps>;
} = ({ children, externalStateControl, onClose, onOpen, onAfterClose }) => {
  const [openedModalName, setOpenedModalName] = useState("");
  const [position, setPosition] = useState<ModalPosition | null>(null);

  /*
   * ModalHoverGuardZone is a CSS pseudo element that is used to prevent the modal from closing
   * when the user hovers over the ModalHoverOpen component.
   * The ModalHoverGuardZone is positioned relative to the ModalHoverOpen component.
   * And the Guard Zone's size is equal to the ModalHoverOpen component's size.
   * And make the Mouse Leave event of the ModalHoverOpen component to be triggered when the mouse
   * leaves the ModalHoverGuardZone.
   */

  const [modalHoverGuardZone, setModalHoverGuardZone] =
    useState<ModalHoverGuardZone | null>(null);
  const [isModalAbove, setIsModalAbove] = useState(false);

  const close = () => {
    onClose?.();
    if (externalStateControl) {
      externalStateControl.setOpenedModalName("");
      onAfterClose?.();
      return;
    }
    setOpenedModalName("");
    onAfterClose?.();
  };
  const open = (name: string) => {
    onOpen?.();
    if (externalStateControl) {
      externalStateControl.setOpenedModalName(name);
      return;
    }
    setOpenedModalName(name);
  };

  const { debouncedFunc: debouncedClose, cancel: cancelDebouncedClose } =
    debounce(() => {
      close();
    }, 500);

  const value = {
    openedModalName: externalStateControl?.openedModalName || openedModalName,
    close,
    open,
    position,
    setPosition,
    isModalAbove,
    setIsModalAbove,
    modalHoverGuardZone,
    setModalHoverGuardZone,
    debouncedClose,
    cancelDebouncedClose,
  };

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
};

const OpenBtn: FC<OpenBtnProps> = ({
  children,
  modalName,
  className = "rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600",
  setPositionByRef = false,
  modalHeight = 0,
  externalControlFunc,
}) => {
  const { open, setPosition, setIsModalAbove } = useContext(ModalContext)!;
  const ref = useRef<HTMLButtonElement>(null);

  const calculatePosition = useCallback(() => {
    const res = calculatePositionByRef(ref, modalHeight);
    const { isModalAbove, position } = res!;
    setIsModalAbove(isModalAbove);
    setPosition(position);
  }, [modalHeight, setIsModalAbove, setPosition]);

  const handleClick = () => {
    if (setPositionByRef) calculatePosition();
    if (externalControlFunc) return externalControlFunc();
    open(modalName);
  };

  useEffect(() => {
    if (!setPositionByRef) return;

    const events = ["wheel", "scroll", "resize"];
    events.forEach(event => {
      window.addEventListener(event, calculatePosition);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, calculatePosition);
      });
    };
  }, [setPositionByRef, calculatePosition]);

  return cloneElement(children, { onClick: handleClick, ref, className });
};

const CloseBtn: FC<CloseBtnProps> = ({ children, onClickFn, className }) => {
  const { close } = useContext(ModalContext)!;

  return cloneElement(children, {
    onClick: () => {
      onClickFn?.();
      close();
    },
    className,
  });
};

const ModalHoverOpen: FC<ModalHoverActivatorProps> = ({
  children,
  modalName,
  modalHeight = 0,
}) => {
  const {
    open,
    setPosition,
    setIsModalAbove,
    setModalHoverGuardZone,
    debouncedClose,
    cancelDebouncedClose,
  } = useContext(ModalContext)!;
  const ref = useRef<HTMLDivElement>(null);

  const { debouncedFunc: debouncedOpen, cancel: cancelDebouncedOpen } =
    debounce(setPositionAndOpen, 500);

  function setPositionAndOpen() {
    const res = calculatePositionByRef(ref, modalHeight);
    if (!res) return;
    setPosition(res.position);
    setIsModalAbove(res.isModalAbove);
    setModalHoverGuardZone({
      height: res.rect.height,
      width: res.rect.width,
    });
    open(modalName);
  }

  function handleMouseEnter() {
    cancelDebouncedClose();
    debouncedOpen();
  }

  function handleMouseLeave() {
    cancelDebouncedOpen();
    debouncedClose();
  }

  return (
    <div
      className="modal-hover-open"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

const Window: FC<WindowProps> = ({
  children,
  name,
  className = "fixed left-1/2 top-1/2 z-[150] flex min-w-[300px] -translate-x-1/2 -translate-y-1/2 transform flex-col items-center gap-12 overflow-auto rounded-lg bg-app-100 p-4 shadow-lg md:min-w-[400px]",
  elementId = "root",
  style = {},
  hoverControl = false,
}) => {
  const {
    openedModalName,
    open,
    close,
    position,
    isModalAbove,
    modalHoverGuardZone,
    debouncedClose,
    cancelDebouncedClose,
  } = useContext(ModalContext)!;

  const { outsideClickRef } = useOutsideClick<HTMLElement>(close);

  function handleMouseEnter() {
    cancelDebouncedClose();
    open(name);
  }

  function handleMouseLeave() {
    debouncedClose();
  }

  if (name !== openedModalName) return null;
  return createPortal(
    <>
      <MainScreen onClickFn={close} darkMode={true} />
      <section
        className={className}
        style={{ ...style, ...position }}
        ref={outsideClickRef}
        onMouseEnter={() => hoverControl && handleMouseEnter()}
        onMouseLeave={() => hoverControl && handleMouseLeave()}
        data-testid="modal-window"
      >
        {children}

        {hoverControl && modalHoverGuardZone && (
          <div
            className="modal-hover-guard-zone"
            style={{
              top: isModalAbove
                ? "100%"
                : `-${modalHoverGuardZone.height / 2}px`,
              height: `${modalHoverGuardZone.height / 2}px` || "10%",
              width: `${modalHoverGuardZone.width}px` || "10%",
            }}
          />
        )}
      </section>
    </>,
    document.getElementById(elementId)!,
  );
};

Modal.OpenBtn = OpenBtn;
Modal.Window = Window;
Modal.CloseBtn = CloseBtn;
Modal.ModalHoverOpen = ModalHoverOpen;
