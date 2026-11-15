# Ticket #37: Sentence panel keyboard navigation

Sentence Mode sheets and dictionary panels use Control on Windows and Command on macOS for navigation from editors. Plain arrows retain native editing, dropdown, radio, and range-slider behavior. Tab and Shift+Tab remain native; existing panel Escape handlers dismiss the panel and the Sentence Mode hook restores trigger focus.

- Arrows: move among panel controls, except within native editing/selection controls.
- Control/Command + arrows: move among controls from editors.
- Enter: activate the focused action; multiline editors retain newlines and single-line editors do not implicitly submit forms.
- Control/Command + Enter in an editor: activate its form submit action, otherwise the last selected action. Disabled submit actions never fall back to panel chrome.
- Shortcuts with the other platform's modifier, Alt, Shift, or both Control and Command are left to the browser/control.

Validation: frontend TypeScript build; keyboard browser fixture with Win32 and MacIntel platform settings in Windows Chrome and Playwright WebKit; real EPUB Sentence Mode and RSVP Chrome suites (desktop and mobile viewports). The real EPUB Sentence Mode suite covers initial editor focus, Enter activation, Escape dismissal, trigger focus restoration, and panel scoping. These are automated platform simulations; actual Chrome and Safari on macOS remain a manual verification item.

Run the keyboard fixture with `node --test scripts/reader-sentence-panel-keyboard.browser.test.cjs`. Set `PLAYWRIGHT_MODULE` to an existing Playwright package if needed; `PLAYWRIGHT_CHANNEL` defaults to `chrome`. Set `RSVP_WEBKIT=1` to use an installed WebKit engine, with `PLAYWRIGHT_BROWSERS_PATH` if it is stored outside the default cache.
