## Cleanup findings

1. `PLACEHOLDER_TEXT` in `gallery.js` is never read; placeholders now come from HTML templates, so the constant is dead code.

:::task-stub{title="Remove unused gallery placeholder constant"}
1. Delete the `PLACEHOLDER_TEXT` declaration at the top of `static/js/gallery.js`.
2. Re-run lint/build if available to confirm no references remain.
:::

2. Five different scripts hand-roll identical `getUsage()` shims, bloating payload and risking drift whenever telemetry changes.

:::task-stub{title="Centralize ScreenshotGallery usage accessor"}
1. Extend `static/js/usage-tracker.js` to expose `window.ScreenshotGallery.getUsage = () => window.ScreenshotGallery.usage || null;`.
2. Replace each local `getUsage` in `static/js/app-init.js`, `capture-core.js`, `gallery.js`, `pdf-export.js`, and `sidebar.js` with the shared helper.
3. Drop the duplicated function definitions and adjust call sites to early-return on falsy helper results.
:::

3. `appendStatus`/`writeStatus` live in `app-init.js` yet `capture-core.js` and `net-fetch.js` call them as implicit globals, coupling load order and hiding dependencies.

:::task-stub{title="Extract status logger into shared module"}
1. Move `writeStatus`/`appendStatus` into a new `static/js/status-log.js` that attaches `{ write, append }` onto `window.ScreenshotGallery`.
2. Include the new script before `app-init.js` and update `app-init`, `capture-core`, and `net-fetch` to import via the shared API instead of relying on globals.
3. Remove the original function declarations from `app-init.js`.
:::

4. The capture blob cache is declared in `capture-core.js` but cleaned via `releaseBlobUrls` inside `app-init.js`, forcing cross-file state mutation.

:::task-stub{title="Encapsulate blob URL lifecycle"}
1. Wrap `blobUrls`, `releaseBlobUrls`, and related helpers inside `capture-core.js`, exporting a `window.ScreenshotGallery.blobs` object with `add(url)`, `revokeAll()`.
2. Update `app-init.js` to call `window.ScreenshotGallery.blobs.revokeAll()` rather than touching internal sets.
3. Ensure `beforeunload` listeners live alongside the blob store to keep ownership localized.
:::

5. Viewport widths for capture (`MODE_VIEWPORT_WIDTHS`) and PDF export (`*_SOURCE_WIDTH`, `*_PAGE_WIDTH`) are duplicated, inviting divergence when defaults change.

:::task-stub{title="Single source viewport sizing config"}
1. Create `static/js/capture-config.js` exporting a frozen map of viewport source widths and derived PDF page widths.
2. Replace hard-coded maps in `capture-core.js` and `pdf-export.js` with reads from the shared config.
3. Document the config so future width changes stay centralized.
:::

6. Sitemap page limits are defined separately client-side (`SITEMAP_PAGE_LIMIT`) and server-side (`PAGE_LIMIT`), making them easy to desync.

:::task-stub{title="Derive sitemap limit from single authority"}
1. Remove `SITEMAP_PAGE_LIMIT` from `static/js/net-fetch.js`; after fetching, read the `limit` field returned by `sitemap-proxy.php`.
2. Update `fetchSitemapUrls` to slice based on the server-provided limit (default to 10 if the field is missing).
3. Keep the PHP constant as the single source and ensure responses always include `limit`.
:::

7. The browser hits a hard-coded proxy at `https://testing2.funkpd.shop/cors.php` even though a bundled `cors.php` is available, complicating self-hosting and testing.

:::task-stub{title="Switch capture proxy to configurable local endpoint"}
1. Change `PROXY_ENDPOINT` in `static/js/net-fetch.js` to read from a `<meta>` or `data-proxy-endpoint`, defaulting to `./cors.php`.
2. Update deployment docs to describe overriding the endpoint when needed.
3. Verify captures still succeed against both the local PHP proxy and any remote override.
:::

8. `pdf-export.js` sticks to `var`/function hoists, diverging from the rest of the ES2015+ code and making refactors harder.

:::task-stub{title="Modernize PDF exporter syntax"}
1. Replace `var` with `const`/`let` throughout `static/js/pdf-export.js`, keeping one declaration per line.
2. Convert helper functions to `const fn = (...) => {}` where appropriate, preserving early-return style.
3. Wrap the module in an IIFE or assign onto `window.ScreenshotGallery` to avoid leaking globals after the refactor.
:::

9. CSS uses `padding-left: none;`, which is invalid and silently ignored, so the collapsed sidebar still occupies space.

:::task-stub{title="Fix collapsed sidebar padding reset"}
1. Replace `padding-left: none;` with `padding-left: 0;` (and adjust related spacing if needed) in `static/css/style.css`.
2. Manually verify the collapsed state actually stretches the gallery full-width.
:::

10. `enforce-zoom.js` spawns an interval but never stores or clears it, so repeated inits could leak timers and the return value is ignored.

:::task-stub{title="Manage zoom watcher lifecycle"}
1. Store the interval ID returned by `setInterval` inside `window.ScreenshotGallery.zoomWatcher`.
2. Clear the interval on `beforeunload` (and before reinitializing) to avoid orphan timers.
3. Guard `document.body` access so the modal creation waits for DOM readiness.
:::

11. `index.html` links to `/static/img/favicon.png`, yet the repo only ships `favicon.webp`, resulting in broken icons unless a PNG is added elsewhere.

:::task-stub{title="Align favicon reference with shipped assets"}
1. Either add a 32×32 `static/img/favicon.png` alongside the `.webp`, or update both `<link>` tags in `index.html` to point at the existing `.webp`.
2. Clear any caches/CDN entries so the correct favicon propagates.
:::

12. Add a timeout to let the page rendering 'settle' - also we need some sort of simulated human interaction

:::task-stub{title="Add timeout and human interaction to settle page"}
1. Find renderPage or wherever the iframe/canvas is made
2. Add a 2 second timeout, simulate human interaction with mouse/keyboard, wait additional 5 seconds.
:::
