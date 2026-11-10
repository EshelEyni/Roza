# Consolidated manuscript navigation

The sidebar selector now contains Chapters, Chapter Overview, Tasks, Characters, Plotlines, Themes, and Notes. The overview header shortcut, More-menu Tasks shortcut, and board return buttons were removed.

Both existing boards render inside the main studio layout, leaving the sidebar available. Board views hide page search, page lists, and add-page controls. Mobile uses the existing drawer and shows the current section in its trigger.

The workspace query parameter records section changes without unmounting the Workspace or its DraftStore. Existing item routes remain valid. Browser back/forward and reload restore the selected section. Selection is retained per category during workspace switches. The existing remembered chapter and save/recovery queue remain in use. The chapter editor stays mounted while boards are visible, preserving undo history and unsaved writing.

Validation covers all seven labels and active options, back/forward, overview editing/reordering, task persistence and sorting, responsive layouts, recovery, and existing studio editing flows.
