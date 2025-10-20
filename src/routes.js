import path from 'path';
import express from 'express';
import PDFDocument from 'pdfkit';
import { fetchSitemap } from './sitemap.js';
import { captureScreenshot } from './screenshot.js';
import { enqueue } from './capture-queue.js';
import { newSession, clearSessionDisk, clearSiteDisk, sessionSummary, listImages } from './session.js';
import config from '../config.js';

const router = express.Router();
const clients = new Set();

function broadcast(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
        client.write(data);
    }
}

function resolveHostname(url) {
    if (!url) return '';
    let parsed;
    try {
        parsed = new URL(url);
    } catch (error) {
        return '';
    }
    const host = parsed.hostname;
    if (!host) return '';
    return host;
}

async function processCapture(urls, cookie, mode) {
    const tasks = [];
    for (const target of urls) {
        const job = enqueue(async () => {
            try {
                const imageData = await captureScreenshot(target, cookie, mode);
                broadcast({ imageData });
                return imageData;
            } catch (error) {
                let message = 'Unknown capture error.';
                if (error) {
                    if (error.message) message = error.message;
                }
                const failure = {
                    status: 'error',
                    host: resolveHostname(target),
                    pageUrl: target,
                    mode,
                    error: message
                };
                broadcast({ imageData: failure });
                return failure;
            }
        });
        tasks.push(job);
    }
    return Promise.all(tasks);
}

function normalizeMode(input) {
    if (!input) return 'desktop';
    const value = String(input).toLowerCase();
    const allowed = ['mobile', 'tablet', 'desktop'];
    for (const mode of allowed) {
        if (mode === value) return value;
    }
    return '';
}

router.post('/capture', async (req, res) => {
    let url = '';
    if (req.body) {
        if (req.body.url) url = req.body.url;
    }
    if (!url) {
        res.status(400).json({ error: 'Missing field url; add to body.' });
        return;
    }
    let cookie = '';
    if (req.body) {
        if (req.body.cookie) cookie = req.body.cookie;
    }
    let modeInput = '';
    if (req.body) {
        if (req.body.mode) modeInput = req.body.mode;
    }
    const mode = normalizeMode(modeInput);
    if (!mode) {
        res.status(400).json({ error: 'Unsupported mode; use mobile, tablet, or desktop.' });
        return;
    }
    try {
        const urls = await fetchSitemap(url);
        if (!urls.length) {
            res.status(400).json({ error: 'Sitemap returned no URLs.' });
            return;
        }
        const results = await processCapture(urls, cookie, mode);
        res.json({ success: true, count: results.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const ping = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
    }, 10000);

    clients.add(res);
    req.on('close', () => {
        clearInterval(ping);
        clients.delete(res);
    });
});

router.post('/session', (req, res) => {
    const dir = newSession();
    res.json({ success: true, session: path.basename(dir) });
});

router.get('/session', (req, res) => {
    res.json(sessionSummary());
});

router.delete('/session', (req, res) => {
    const host = req.query.host;
    if (host) {
        clearSiteDisk(host);
        res.json({ success: true, cleared: host });
        return;
    }
    clearSessionDisk();
    res.json({ success: true, cleared: 'session' });
});

router.get('/pdf', (req, res) => {
    const images = listImages();
    if (!images.length) {
        res.status(400).json({ error: 'No screenshots available for export.' });
        return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="screenshots.pdf"');
    const doc = new PDFDocument({ autoFirstPage: false, margin: 36 });
    doc.on('error', (error) => {
        res.destroy(error);
    });
    doc.pipe(res);
    for (const image of images) {
        doc.addPage({ size: 'A4', margin: 36 });
        doc.fontSize(12).fillColor('#111827');
        doc.text(`${image.host} — ${path.basename(image.filepath)}`, { align: 'left' });
        doc.moveDown();
        doc.image(image.filepath, {
            fit: [doc.page.width - 72, doc.page.height - 144],
            align: 'center',
            valign: 'center'
        });
    }
    doc.end();
});

router.use('/static', express.static(path.join(config.paths.baseDir, 'static')));

router.get('/', (req, res) => {
    res.sendFile(path.join(config.paths.baseDir, 'static/index.html'));
});

export function setupRoutes(app) {
    app.use('/', router);
}
