export type BookTab = "changes" | "browse";

/** Switches the open book between its waiting changes and the read-only live book. */
export function BookTabs({ tab, waiting, onChange }: { tab: BookTab; waiting: number; onChange: (tab: BookTab) => void }) {
  const tabs: { id: BookTab; label: string }[] = [
    { id: "changes", label: `Changes (${waiting})` },
    { id: "browse", label: "Browse book" },
  ];
  return (
    <div className="sr-tabs" role="tablist" aria-label="Book view">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
