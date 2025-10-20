# Screenshot Pro

Simple sitemap screenshot collector using PHP and vanilla JS.

## Requirements
- PHP 8.1 or newer
- `json`, `mbstring`, and either `imagick` **or** `gd` extensions

## Quick Start
1. Install PHP dependencies: `sudo apt-get install php php-imagick` (or `php-gd` if Imagick unavailable).
2. Start the server: `php -S 0.0.0.0:3200 -t public`.
3. Visit [http://localhost:3200](http://localhost:3200) in your browser.

## Data & Storage
- Screenshots are stored under `static/screenshots/<session-id>/`.
- Metadata for each PNG lives in a sibling `.json` file.
- Current session ID is tracked in `var/current-session.txt`.

## API Endpoints
- `GET /capture/status` — session summary and stored images.
- `POST /capture/store` — persist a base64 PNG payload.
- `GET /capture/sitemap?url=https://example.com` — proxy sitemap fetch.
- `GET /proxy?url=https://example.com` — raw HTML proxy used by the client.
- `POST /session` — begin a new session; `DELETE /session?host=example.com` clears disk.
- `GET /export/pdf` — download a PDF assembled from stored screenshots.
- `GET /export/offline` — download a self-contained HTML archive.

Run `php -S` from the project root so static assets resolve correctly.
