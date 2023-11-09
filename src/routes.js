// Required modules and configurations
import path from "path";
import express from "express";
import { fetchSitemap } from "./sitemap.js";
import { captureDesktopScreenshot } from "./screenshot.js";
import config from "../config.js";

// This array will store active clients for the SSE stream. It's global 
// because we want to keep track of all clients across requests.
const clients = [];

const router = express.Router();

/**
 * Endpoint to capture screenshots for pages listed in the provided sitemap URL.
 * It makes use of both the sitemap and screenshot utility functions.
 */
router.post("/capture", async (req, res) => {
	const { url } = req.body;

	try {
		// Attempt to fetch sitemap for the URL.
		const sitemapResponse = await fetchSitemap(url);

		// Validate sitemap response. If it's not structured as expected, send an error.
		if (!sitemapResponse.success || !Array.isArray(sitemapResponse.sitemap)) {
			return res.status(400).json({ error: "Failed to fetch or process sitemap" });
		}

		const results = [];
		for (const siteUrl of sitemapResponse.sitemap) {
			const imageData = await captureDesktopScreenshot(siteUrl);

			// Broadcast the new screenshot data to all connected clients.
			// This is a form of real-time communication using SSE.
			clients.forEach((client) => {
				client.write(`data: ${JSON.stringify({ imageData })}\n\n`);
			});
			results.push(imageData);
		}

		res.json({ success: true, results });
	} catch (error) {
		// Handle unexpected errors.
		console.error(error);
		res.status(500).json({ success: false, error: error.message });
	}
});

/**
 * SSE Endpoint for client-side streaming.
 * Clients connected here will receive real-time updates, such as the screenshots captured.
 */
router.get("/stream", (req, res) => {
	// Headers specific to Server-Sent Events to ensure connection remains open.
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	// Send periodic pings to ensure the client connection remains active.
	const pingInterval = setInterval(() => {
		res.write('data:{"type": "ping"}\n\n');
	}, 1000);

	clients.push(res);  // Add new client to the global list

	// Clean up once a client disconnects.
	req.on("close", () => {
		clearInterval(pingInterval);
		const index = clients.indexOf(res);
		if (index !== -1) {
			clients.splice(index, 1);
		}
	});
});

// Static file serving for the app's assets.
router.use("/static", express.static(path.join(config.paths.baseDir, "static")));

// Default route to serve the application's main page.
router.get("/", (req, res) => {
	res.sendFile(path.join(config.paths.baseDir, "static/index.html"));
});

/**
 * Setup function to integrate this router into the main app.
 * This makes our router modular and can be imported into the main server file.
 */
function setupRoutes(app) {
	app.use("/", router);
}

export { setupRoutes };
