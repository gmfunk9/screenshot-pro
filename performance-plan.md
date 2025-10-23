# Screenshot Capture Reliability Plan

## Goals
- Keep browser responsive while capturing real pages; no UI freeze, no GPU/CPU spikes.
- Reduce per-screenshot memory footprint and canvas size.
- Produce downscaled, lightweight screenshots that still show real page content.

## High-Level Approach
1. Preprocess remote HTML to strip heavy behaviors before the iframe loads.
2. Render the page in constrained tiles, stitch into a much smaller offscreen canvas, and discard intermediary buffers immediately.
3. Apply aggressive visual simplification (system fonts, solid backgrounds, no animations).
4. Export async blobs (PNG or WebP) and send binary payloads without base64 bloat.
5. Fix server/storage pipeline to match new formats and avoid recompression.

## Detailed Steps

### 1. Harden HTML Preprocessing
- Parse the fetched HTML string before `doc.write`.
- Remove:
  - `<script>` tags, inline event handlers (`on*=` attributes), and `<link rel="preload|prefetch|modulepreload">`.
  - `<style>` tags and inline `style` attributes that trigger animations, transitions, filters, fixed backgrounds.
- Inject a minimal stylesheet that:
  - Forces system fonts, solid backgrounds, `background-image: none !important`, `box-shadow: none !important`, `filter: none !important`.
  - Hides or caps resource-heavy elements (`img`, `video`, `canvas`, `iframe`) via CSS, not post-load DOM surgery.
- Result: iframe paints a muted version of the page with minimal layout work.

### 2. Controlled Iframe Environment
- When creating the iframe:
  - Set `sandbox` attribute with `allow-same-origin` only if required for fonts; otherwise keep execution locked down.
  - Disable `frame.onload` execution of remaining scripts by `srcdoc` approach with sanitized HTML.
  - After writing content, explicitly stop resource loading by setting `doc.documentElement.innerHTML` if needed to abort remaining fetches.

### 3. Tile-Based Raster Pipeline
- Replace the single `renderCanvas(doc, width, height)` call with tiling:
  1. Decide final preview width (e.g., 512 px) and proportional tile height (<=512).
  2. For each tile:
     - Call html2canvas with `x: 0`, `y: tileOffset`, `width: desiredViewport`, `height: tileSize`, `scale: 1`.
     - Immediately draw the returned tile into a persistent `OffscreenCanvas` or hidden `<canvas>` sized to the *downscaled* dimensions.
     - Invoke `canvas.width = canvas.height = 0` on the per-tile canvas to free memory.
  3. After final tile, read the stitched canvas as a blob.
- Insert `await yield()` between tiles to keep the main thread responsive.
- Ensure you clamp total tiles to the sanitized page height cap (e.g., 2048 px total).

### 4. Downscale & Compress
- Use the stitched canvas to perform a single draw into a small resolution (e.g., width 512, height auto).
- Export via `canvas.convertToBlob({ type: 'image/webp', quality: 0.7 })` (Chrome) with a fallback using `canvas.toBlob`.
- Avoid base64 conversion:
  - Send via `fetch('/capture/store', { method: 'POST', body: FormData })`.
  - Include width/height metadata separately.

### 5. PHP Storage Alignment
- Update `php/capture.php`:
  - Accept multipart/form-data, read the binary blob, and write `.webp` (or `.png` if we keep PNG).
  - Store reported `dimensions` and `mime`.
  - Serve `imageUrl` pointing to the new extension.
- Update gallery rendering (`static/js/gallery.js`) to read `mime` for `<img src>`.

### 6. Progressive Capture Queue
- Wrap `capturePages` loop with an explicit queue manager:
  - Only process one URL at a time.
  - Between captures add `await idle()` to allow UI paint.
  - Surface progress via status callback so the demo stays interactive.

### 7. Validation Checklist
- Run capture on 2–3 heavy landing pages while DevTools performance panel is open; confirm main thread idle gaps and no “Status: unresponsive”.
- Inspect saved assets to confirm width ≤ 512 and file size reasonable (~50–150 KB).
- Verify gallery displays new WebP paths from PHP.
- Ensure sanitized HTML still renders readable screenshots (fonts fall back to system stack, content legible).

## Sequencing
1. Implement HTML sanitization + CSS overrides.
2. Build tiling renderer and downscale pipeline.
3. Switch client upload path to blob/FormData.
4. Adjust PHP endpoints to store blobs correctly.
5. Test end-to-end; tweak caps (width/height/quality) based on output vs. responsiveness.
