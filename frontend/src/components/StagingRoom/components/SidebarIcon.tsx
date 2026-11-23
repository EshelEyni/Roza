/** A panel with an arrow: points out to open the sidebar, in to close it. */
export function SidebarIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <polyline points={open ? "15 9 12 12 15 15" : "13 9 16 12 13 15"} />
    </svg>
  );
}
