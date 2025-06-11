// Required modules and configurations
import path from "path";
import fs from "fs";
import express from "express";
import puppeteer from "puppeteer";
import { fetchSitemap } from "./sitemap.js";
import { captureDesktopScreenshot } from "./screenshot.js";
import { newSession, clearSessionDisk, clearSiteDisk, listImages, sessionPath } from "./session.js";
import config from "../config.js";

// This array will store active clients for the SSE stream. It's global 
// because we want to keep track of all clients across requests.
const clients = [];

const router = express.Router();

router.post('/session', (req, res) => {
        newSession();
        res.json({ success: true });
});

router.delete('/session', (req, res) => {
        const host = req.query.host;
        if (host) {
                clearSiteDisk(host.replace(/\./g, '_'));
        } else {
                clearSessionDisk();
        }
        res.json({ success: true });
});

async function createPdf() {
        const images = listImages();
        if (!images.length) {
                throw new Error('No screenshots found');
        }
        const html = '<html><body>' + images.map(p => `<img src="file://${p}" style="width:100%;page-break-after:always;">`).join('') + '</body></html>';
        const htmlPath = path.join(sessionPath(), 'temp.html');
        fs.writeFileSync(htmlPath, html);
        const browser = await puppeteer.launch({ executablePath: puppeteer.executablePath(), headless: 'new' });
        const page = await browser.newPage();
        await page.goto('file://' + htmlPath);
        const pdfPath = path.join(sessionPath(), 'screenshots.pdf');
        await page.pdf({ path: pdfPath, printBackground: true });
        await browser.close();
        fs.unlinkSync(htmlPath);
        return pdfPath;
}

router.get('/pdf', async (req, res) => {
        try {
                const pdfPath = await createPdf();
                res.download(pdfPath, 'screenshots.pdf');
        } catch (error) {
                res.status(500).json({ error: error.message });
        }
});

/**
 * Endpoint to capture screenshots for pages listed in the provided sitemap URL.
 * It makes use of both the sitemap and screenshot utility functions.
 */
router.post("/capture", async (req, res) => {
        const url = req.body.url;
        const cookie = req.body.cookie ? req.body.cookie : '';
        if (!url) {
                res.status(400).json({ error: "Missing field url; add to body." });
                return;
        }

        try {
                const sitemapUrls = await fetchSitemap(url);
                const results = [];

                for (const siteUrl of sitemapUrls) {
                        const imageData = await captureDesktopScreenshot(siteUrl, cookie);
                        clients.forEach((client) => {
                                client.write(`data: ${JSON.stringify({ imageData })}\n\n`);
                        });
                        results.push(imageData);
                }

                res.json({ success: true, results });
        } catch (error) {
                console.error(error);
                res.status(500).json({ error: error.message });
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
