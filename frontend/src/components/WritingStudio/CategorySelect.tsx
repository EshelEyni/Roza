import { useEffect, useId, useRef, useState } from "react";
import { sectionLabel, StudioSection } from "./studioNavigation";
export function CategorySelect({
  value,
  options,
  onChange,
}: {
  value: StudioSection;
  options: StudioSection[];
  onChange: (value: StudioSection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const label = sectionLabel;
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const choose = (index: number) => {
    onChange(options[index]);
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div
      ref={root}
      className="ws-category-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-label="Manuscript category"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-activedescendant={open ? id + "-" + active : undefined}
        onClick={() => {
          setActive(options.indexOf(value));
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
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              open
                ? (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    options.length) %
                  options.length
                : options.indexOf(value),
            );
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setOpen(true);
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else {
              setActive(options.indexOf(value));
              setOpen(true);
            }
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const index = options.findIndex((option) =>
              option.startsWith(event.key.toLowerCase()),
            );
            if (index >= 0) {
              event.preventDefault();
              setOpen(true);
              setActive(index);
            }
          }
        }}
      >
        {label(value)}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          id={id}
          role="listbox"
          aria-label="Manuscript categories"
          className="ws-category-options"
        >
          {options.map((option, index) => (
            <div
              key={option}
              id={id + "-" + index}
              role="option"
              aria-selected={option === value}
              className={index === active ? "is-active" : ""}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {label(option)}
              {option === value && <span aria-hidden="true">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
