- [x] Layout & IA
Header crams capture form and five CTAs into a single glassmorphic bar; reorganize into a calm two-pane workspace so controls stop fighting the gallery.

:::task-stub{title="Replace crowded header with sidebar layout"}
1. Redesign `static/index.html` so controls live in a fixed `<aside>` (capture form, session buttons, export actions) and screenshots occupy a `<main>` gallery pane.
2. Rewire `static/css/style.css` to use CSS Grid for a left sidebar + right content layout; drop ad-hoc flex utility classes.
3. Adjust `static/js/main.js` queries to match the new element IDs/classes and ensure focus states work without nesting.
:::

- [x] Visual System
CSS double-defines `body`, forces full-screen background photos, and stacks heavy shadows; establish a small design token set and accessible theme.

:::task-stub{title="Create minimal design system"}
1. Introduce CSS custom properties in `static/css/style.css` for colors, spacing, and typography; delete duplicate `body` blocks and random Unsplash backgrounds.
2. Define reusable button, form, and card classes with flat borders, soft elevation, and focus-visible outlines.
3. Generate a minified build (e.g., via npm script) to regenerate `style.min.css` after cleanup.
:::

- [x] Front-end Logic
`static/js/main.js` owns DOM wiring, SSE lifecycle, screenshot templating, export, and session management in one closure—SRP is broken and hard to test.

:::task-stub{title="Modularize front-end controller"}
1. Split `static/js/main.js` into ES modules: `events.js` (DOM listeners), `sse.js` (EventSource lifecycle), `gallery.js` (render/update), `actions.js` (save/export/session).
2. Use dependency injection so modules get DOM refs from a single initializer; ensure each function early-returns on invalid state.
3. Add lightweight unit tests (Vitest or similar) for URL validation, SSE reconnection, and gallery rendering.
:::

- [x] Interaction Model
`fpgrab.js` hand-rolls drag momentum with global listeners; feels jittery and fights native scroll.

:::task-stub{title="Drop custom grabber for native scroll"}
1. Delete `static/js/fpgrab.js`; rely on CSS `overflow-x: auto` plus `scroll-snap` for gallery navigation.
2. If kinetic scroll is still desired, replace with a tiny passive helper that only listens on the gallery element and mutates `scrollLeft`.
3. Update `static/js/main.js` to remove `templateImageWrap` assumptions tied to transform-based translation.
:::

- [x] API & Workflow
UI calls `/session` POST/DELETE and `/pdf`, but router only exposes `/capture` and `/stream`, so half the controls are dead weight.

:::task-stub{title="Implement missing session and export endpoints"}
1. Add `src/controllers/session.js` to wrap `session.js` helpers; expose POST new-session, DELETE by host, and GET list endpoints via router.
2. Implement `/pdf` route that streams a generated PDF (e.g., pdfkit) from current session screenshots.
3. Wire new endpoints into `src/routes.js` and cover with supertest integration tests.
:::

- [x] Capture Pipeline
`/capture` fetches the entire sitemap sequentially; each screenshot launches a fresh browser and closes it—slow and brittle.

:::task-stub{title="Introduce browser pool and queued capture"}
1. Extract Puppeteer lifecycle into `src/browser.js` that maintains a singleton browser and per-request pages; ensure early returns on launch failures.
2. Replace synchronous `for` loop in `src/routes.js` with a queue that streams progress as soon as each screenshot completes (limit concurrency to keep memory sane).
3. Extend responses to include error details per URL and update front-end gallery renderer to surface failed entries cleanly.
:::

- [x] Testing
Not run (static analysis only).
