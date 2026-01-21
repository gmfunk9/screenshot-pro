import path from 'path';
import express from 'express';
import PDFDocument from 'pdfkit';
import { fetchSitemap } from './sitemap.js';
import { captureScreenshot } from './screenshot.js';
import { enqueue } from './capture-queue.js';
import { newSession, clearSessionDisk, clearSiteDisk, sessionSummary, listImages } from './session.js';
import config from '../config.js';
import { logger, subscribe } from './logger.js';

const router = express.Router();
const clients = new Set();
let logSubscribed = false;

function broadcast(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
        client.write(data);
    }
}

function broadcastStatus(message, meta = {}) {
    if (!message) return;
    broadcast({ type: 'status', message, ...meta });
}

function expandTasks(urls, mode) {
    const modes = mode === 'all' ? ['desktop', 'tablet', 'mobile'] : [mode];
    const tasks = [];
    for (const url of urls) {
        for (const item of modes) {
            tasks.push({ url, mode: item });
        }
    }
    return tasks;
}

async function processCapture(urls, cookie, mode) {
    const tasks = expandTasks(urls, mode);
    logger.info('routes', 'Processing capture batch', { count: tasks.length, mode });
    const jobs = [];
    let index = 0;
    for (const task of tasks) {
        index += 1;
        const position = index;
        broadcastStatus(`Queued ${position}/${tasks.length}`, { step: 'queued', index: position, total: tasks.length, pageUrl: task.url, mode: task.mode });
        const job = enqueue(async () => {
            try {
                const startedAt = Date.now();
                broadcastStatus(`Capturing ${position}/${tasks.length}`, { step: 'capturing', index: position, total: tasks.length, pageUrl: task.url, mode: task.mode });
                logger.info('routes', 'Capturing URL', { url: task.url, index: position, total: tasks.length, mode: task.mode });
                const imageData = await captureScreenshot(task.url, cookie, task.mode);
                const elapsed = Math.round((Date.now() - startedAt) / 1000);
                if (imageData && imageData.status === 'captured') {
                    broadcastStatus(`Captured ${position}/${tasks.length} (${elapsed}s)`, { step: 'captured', index: position, total: tasks.length, pageUrl: task.url, seconds: elapsed, mode: task.mode });
                } else if (imageData && imageData.status === 'exists') {
                    broadcastStatus(`Exists ${position}/${tasks.length} (${elapsed}s)`, { step: 'exists', index: position, total: tasks.length, pageUrl: task.url, seconds: elapsed, mode: task.mode });
                }
                logger.info('routes', 'Capture finished', { url: task.url, status: imageData?.status || 'unknown', seconds: elapsed, mode: task.mode });
                broadcast({ imageData });
                return imageData;
            } catch (error) {
                logger.error('routes', 'Capture error', { url: task.url, error: error.message, mode: task.mode });
                const failure = {
                    status: 'error',
                    host: new URL(task.url).hostname,
                    pageUrl: task.url,
                    mode: task.mode,
                    error: error.message
                };
                broadcastStatus(`Failed ${position}/${tasks.length}`, { step: 'failed', index: position, total: tasks.length, pageUrl: task.url, error: error.message, mode: task.mode });
                broadcast({ imageData: failure });
                return failure;
            }
        });
        jobs.push(job);
    }
    return Promise.all(jobs);
}

function normalizeMode(input) {
    if (!input) return 'desktop';
    const value = String(input).toLowerCase();
    const allowed = ['mobile', 'tablet', 'desktop', 'all'];
    for (const mode of allowed) {
        if (mode === value) return value;
    }
    return '';
}

router.post('/capture', async (req, res) => {
    broadcastStatus('Capture request received.', { step: 'start' });
    logger.info('routes', 'Capture request received');
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
        res.status(400).json({ error: 'Unsupported mode; use mobile, tablet, desktop, or all.' });
        logger.warn('routes', 'Unsupported mode', { mode: modeInput });
        return;
    }
    try {
        let urls = [];
        const manualList = Array.isArray(req.body?.urls) ? req.body.urls : [];
        if (manualList.length) {
            urls = manualList.map((entry) => String(entry).trim()).filter(Boolean);
            broadcastStatus(`Manual list loaded (${urls.length} URLs)`, { step: 'manual', total: urls.length });
            logger.info('routes', 'Manual list loaded', { count: urls.length });
        } else {
            broadcastStatus('Fetching sitemap…', { step: 'sitemap' });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            logger.info('routes', 'Fetching sitemap', { url });
            urls = await fetchSitemap(url, {
                signal: controller.signal,
                onStatus: (message) => broadcastStatus(message, { step: 'sitemap' })
            });
            clearTimeout(timeoutId);
        }
        if (!urls.length) {
            res.status(400).json({ error: 'No URLs to capture.' });
            logger.warn('routes', 'No URLs returned');
            return;
        }
        if (manualList.length) {
            broadcastStatus(`Manual list accepted (${urls.length} URLs)`, { step: 'manual', total: urls.length });
        } else {
            broadcastStatus(`Sitemap loaded (${urls.length} URLs)`, { step: 'sitemap', total: urls.length });
        }
        logger.info('routes', 'Queueing captures', { count: urls.length, mode });
        processCapture(urls, cookie, mode).catch((error) => {
            const failure = {
                status: 'error',
                host: new URL(url).hostname,
                pageUrl: url,
                mode,
                error: error.message
            };
            broadcast({ imageData: failure });
            broadcastStatus('Capture batch failed', { step: 'failed', error: error.message });
            logger.error('routes', 'Capture batch failed', { error: error.message });
        });
        res.json({ success: true, count: urls.length, queued: true });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            res.status(504).json({ error: 'Sitemap request timed out.' });
            logger.warn('routes', 'Sitemap request timed out', { url });
            return;
        }
        res.status(500).json({ error: error.message });
        logger.error('routes', 'Capture request failed', { error: error.message });
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

    if (!logSubscribed) {
        logSubscribed = true;
        subscribe((payload) => {
            if (clients.size === 0) return;
            broadcast({ type: 'log', ...payload });
        });
    }

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
