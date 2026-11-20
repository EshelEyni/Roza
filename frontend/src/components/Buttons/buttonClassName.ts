export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Class names for the shared button look (Ticket #57). */
export function buttonClassName(
  variant: ButtonVariant = "secondary",
  isSmall = false,
) {
  return [
    "ui-btn",
    variant !== "secondary" && `ui-btn-${variant}`,
    isSmall && "ui-btn-small",
  ]
    .filter(Boolean)
    .join(" ");
}
