# Ticket: Default reading progress indicator in Reader Settings

## Objective
Let users choose which footer progress indicator appears by default, using Reader Settings alongside the existing page-numbering preference.

## Requirements
- Add a setting labeled **Default progress indicator** with three options:
  - Percentage
  - Pages left in section (`Section: 67 left`)
  - Pages left in book (`Book: 423 left`)
- Use the chosen default when opening or reopening a book.
- Persist the preference through the existing authenticated reader-preferences mechanism, following the same scope and inheritance behavior as page numbering.
- Existing users without a saved preference default to Percentage.
- Keep clicking the footer indicator to cycle through the three displays. This changes the current display; only choosing an option in Settings changes the saved default.
- Changing the default in Settings updates the current indicator immediately.
- Reuse current remaining-page calculations and loading states. Do not change reading position, pagination, or page-numbering behavior.
- Support desktop and mobile, translated labels, and accessible setting controls.

## Acceptance criteria
1. Each option can be selected in Settings and appears immediately in the footer.
2. Reloading and reopening the reader restores the saved default.
3. Clicking the footer still cycles through all three displays without overwriting the saved default.
4. Readers without a saved preference continue to start with Percentage.
5. Preferences remain isolated between authenticated users and follow existing book-preference behavior.
6. Page navigation, font/viewport changes, and fullscreen update counts correctly without changing the selected display mode.
7. Verify desktop and iPhone Safari behavior, including keyboard accessibility and the page-count loading state.

## Scope
Settings, preference validation/persistence, footer initialization, and appropriate tests only. Do not redesign the reader or change the remaining-page calculations.
