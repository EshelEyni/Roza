/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { AnyFunction } from "@rozaeyni/common-types";
import { FC, cloneElement, createContext, useContext, useState } from "react";

type DisplayEditFieldContextType = {
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
};

type DisplayEditFieldProviderProps = {
  children: React.ReactNode;
};

type DisplayElement = {
  children: React.ReactElement;
  className?: string;
};

type EditElementProps = {
  children: React.ReactElement;
  onChange: AnyFunction;
  className?: string;
};

type SaveButtonProps = {
  children: React.ReactElement;
  onSubmit: AnyFunction;
  className?: string;
};

type EditButtonProps = {
  children: React.ReactElement;
  className?: string;
};

const displayEditContext = createContext<
  DisplayEditFieldContextType | undefined
>(undefined);

export const DisplayEditField: FC<DisplayEditFieldProviderProps> & {
  DisplayElement: FC<DisplayElement>;
  EditElement: FC<EditElementProps>;
  SaveButton: FC<SaveButtonProps>;
  EditButton: FC<EditButtonProps>;
} = ({ children }) => {
  const [isEditing, setIsEditing] = useState(false);

  const value = {
    isEditing,
    setIsEditing,
  };

  return (
    <displayEditContext.Provider value={value}>
      {children}
    </displayEditContext.Provider>
  );
};

export const DisplayElement: FC<DisplayElement> = ({ children, className }) => {
  const { isEditing, setIsEditing } = useContext(displayEditContext)!;

  let lastTap = 0;

  function handleDescDoubleClicked() {
    setIsEditing(true);
  }

  function handleTouchEnd() {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) setIsEditing(true);
    lastTap = currentTime;
  }

  if (isEditing) return null;

  return cloneElement(children, {
    onDoubleClick: handleDescDoubleClicked,
    onTouchEnd: handleTouchEnd,
    className,
  });
};

export const EditElement: FC<EditElementProps> = ({
  children,
  onChange,
  className,
}) => {
  const { isEditing } = useContext(displayEditContext)!;

  if (!isEditing) return null;

  return cloneElement(children, {
    onChange,
    className,
  });
};

export const SaveButton: FC<SaveButtonProps> = ({
  children,
  onSubmit,
  className,
}) => {
  const { isEditing, setIsEditing } = useContext(displayEditContext)!;

  function handleSave() {
    onSubmit();
    setIsEditing(false);
  }

  if (!isEditing) return null;

  return cloneElement(children, {
    onClick: handleSave,
    className,
  });
};

export const EditButton: FC<EditButtonProps> = ({ children, className }) => {
  const { isEditing, setIsEditing } = useContext(displayEditContext)!;

  function handleClick() {
    setIsEditing(true);
  }

  if (isEditing) return null;

  return cloneElement(children, {
    onClick: handleClick,
    className,
  });
};

export const Title: FC<EditButtonProps> = ({ children, className }) => {
  const { isEditing, setIsEditing } = useContext(displayEditContext)!;

  function handleClick() {
    setIsEditing(true);
  }

  if (isEditing) return null;

  return cloneElement(children, {
    onClick: handleClick,
    className,
  });
};

DisplayEditField.DisplayElement = DisplayElement;
DisplayEditField.EditElement = EditElement;
DisplayEditField.SaveButton = SaveButton;
DisplayEditField.EditButton = EditButton;
