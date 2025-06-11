# Screenshot Pro
Simple site screenshot tool.

## Quick Start
1. `npm install`
2. `node index.js`

Use `/session` POST to start a new folder. DELETE `/session?host=example.com` removes screenshots for that host.

Visit `http://localhost:3200` for the UI. POST `/capture` with `{url, cookie}` for API access.
