import path from 'path';
import express from 'express';
import { fetchSitemap } from './sitemap.js';
import { captureDesktopScreenshot } from './screenshot.js';
import config from '../config.js';

const clients = [];
const router = express.Router();

router.post('/capture', async (req, res) => {
    const url = req.body.url;
    if (!url) {
        res.status(400).json({ error: 'Missing field url; add to body.' });
        return;
    }

    const cookie = req.body.cookie || '';
    try {
        const sitemapUrls = await fetchSitemap(url);
        const results = [];
        for (const siteUrl of sitemapUrls) {
            const imageData = await captureDesktopScreenshot(siteUrl, cookie);
            clients.forEach((c) => c.write(`data: ${JSON.stringify({ imageData })}\n\n`));
            results.push(imageData);
        }
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const pingInterval = setInterval(() => {
        res.write('data:{"type": "ping"}\n\n');
    }, 1000);

    clients.push(res);

    req.on('close', () => {
        clearInterval(pingInterval);
        const index = clients.indexOf(res);
        if (index !== -1) clients.splice(index, 1);
    });
});

router.use('/static', express.static(path.join(config.paths.baseDir, 'static')));

router.get('/', (req, res) => {
    res.sendFile(path.join(config.paths.baseDir, 'static/index.html'));
});

export function setupRoutes(app) {
    app.use('/', router);
}
