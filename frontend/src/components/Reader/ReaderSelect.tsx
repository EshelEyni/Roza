import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown } from "react-icons/fi";

/** Reader-themed listbox, following the app's category picker keyboard behavior. */
export function ReaderSelect<T extends string>({
  id,
  labelId,
  value,
  options,
  onChange,
}: {
  id: string;
  labelId: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const selected = options.findIndex((option) => option.value === value);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div
      className="reader-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        id={id}
        ref={button}
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id + "-options"}
        aria-activedescendant={open ? id + "-option-" + active : undefined}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
            return;
          }
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : open
                    ? (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        options.length) %
                      options.length
                    : selected,
            );
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else {
              setActive(selected);
              setOpen(true);
            }
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const index = options.findIndex((option) =>
              option.label
                .toLocaleLowerCase()
                .startsWith(event.key.toLocaleLowerCase()),
            );
            if (index >= 0) {
              event.preventDefault();
              setOpen(true);
              setActive(index);
            }
          }
        }}
      >
        {options[selected]?.label}
        <FiChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div
          id={id + "-options"}
          role="listbox"
          aria-labelledby={labelId}
          className="reader-select-options"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={id + "-option-" + index}
              role="option"
              aria-selected={value === option.value}
              className={active === index ? "is-active" : ""}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {option.label}
              {value === option.value && <FiCheck aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
