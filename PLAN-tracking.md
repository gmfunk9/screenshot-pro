# Usage Tracking Plan

## Goals
- Understand how users run captures, browse galleries, and export artifacts without storing raw personal data.
- Provide aggregated counters and timing metrics that can inform UX improvements and capacity planning.
- Emit structured telemetry that downstream analytics or support tooling can consume in real time.

## Guiding Constraints
- YAGNI/KISS: Implement the smallest surface that answers core product questions.
- DRY: Centralize telemetry helpers in a single module.
- No persistent raw logs; keep data in-memory per session and emit summarized events.
- One condition per line; avoid chained logical operators when wiring handlers.

## Core Telemetry Module (`static/js/usage-tracker.js`)
- Export a singleton `usage` object on `window.ScreenshotGallery`.
- Provide helpers:
  - `recordUsage(eventName, payload)` for counter-based events.
  - `startTimer(timerName)` and `stopTimer(timerName)` returning elapsed ms.
  - `snapshot()` returning the current aggregate state for debugging.
- Maintain in-memory structure: `{ counters: { [event]: count }, totals: { [event]: number }, timers: { [name]: { startedAt, totalMs, runs } } }`.
- Dispatch `CustomEvent('screenshotpro:usage', { detail })` on each mutation so other modules can listen without tight coupling.

## Capture Funnel Instrumentation
- `static/js/app-init.js`
  - Call `usage.startTimer('session')` when initialization begins.
  - After sitemap fetch completes, emit `usage.recordUsage('sitemap-fetched', { urlCount })`.
  - When capture loop finishes, call `usage.stopTimer('session')` and `usage.recordUsage('session-complete', { pages, durationMs, mode })`.
  - On fatal error, emit `usage.recordUsage('session-error', { message })` before surfacing UI feedback.
- `static/js/net-fetch.js`
  - After deduplicating sitemap URLs, record `usage.recordUsage('sitemap-candidate', { count })`.
- `static/js/capture-core.js`
  - Wrap `capturePage` with timer start/stop per URL to measure capture duration and resolution metadata.
  - Emit success and error events with `mode`, `dimensions`, `durationMs`, and sanitized `urlHash` (avoid raw URLs if privacy sensitive).

## Interaction Analytics
- `static/js/gallery.js`
  - Tag gallery cards with data attributes and record `gallery-view` events on interactions.
  - Emit `gallery-cleared`, `gallery-share`, and `gallery-download` counters as appropriate.
- `static/js/pdf-export.js`
  - Track export start, success (page count, duration), and failure (error message).
- `static/js/sidebar.js`
  - Record `sidebar-toggle` with the resulting state (`open`/`closed`).
- `static/js/app-init.js`
  - Capture filter/sort dropdown changes via `usage.recordUsage('gallery-filter-change', { value })` if applicable.

## Surfacing Telemetry
- Provide `window.addEventListener('screenshotpro:usage', handler)` example snippet for future dashboards.
- Consider optional `navigator.sendBeacon` extension later for server-side aggregation; defer until requirements clarified.

## Open Questions
1. Should telemetry survive page reloads (localStorage) or remain per-session? Default to per-session for now.
2. Any PII constraints on URL capture? Use hashed identifiers if storing beyond runtime.
3. Who consumes `CustomEvent` stream? Document expectation for analytics listeners.

