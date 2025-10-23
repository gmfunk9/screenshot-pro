(function () {
    'use strict';

const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1920 };
const PROXY_ENDPOINT = '/proxy';
const MAX_CAPTURE_HEIGHT = 12000;
const CAPTURE_SCALE = 0.5;
const OUTPUT_SCALE = 0.25;
const TILE_HEIGHT = 512;
const EXPORT_MIME = 'image/webp';
const EXPORT_QUALITY = 0.7;
const HEAVY_STYLE_KEYWORDS = [
  'animation', 'transition', 'filter', 'backdrop-filter',
  'box-shadow', 'background-attachment', 'background-image',
  'transform', 'perspective'
];
const PRELOAD_REL_BLOCKLIST = new Set(['preload', 'modulepreload', 'prefetch', 'prerender']);

const notify = (fn, msg) => fn?.(msg);

const ensureHtml2Canvas = () => {
  if (typeof window.html2canvas === 'function') return window.html2canvas;
  throw new Error('Missing html2canvas; include script.');
};

const computeViewportWidth = mode => VIEWPORTS[mode] || VIEWPORTS.desktop;

async function fetchSnapshot(url, cookie, onStatus) {
  notify(onStatus, `Fetching ${url}`);
  const endpoint = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}${cookie ? `&cookie=${encodeURIComponent(cookie)}` : ''}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Proxy ${res.status} for ${url}`);
  return res.text();
}

function stripInlineEvents(doc) {
  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
  });
}

function stripHeavyStyles(doc) {
  doc.querySelectorAll('[style]').forEach(el => {
    const val = el.getAttribute('style')?.toLowerCase() || '';
    if (HEAVY_STYLE_KEYWORDS.some(k => val.includes(k))) el.removeAttribute('style');
  });
}

function sanitizeHtml(html) {
  if (typeof html !== 'string' || html === '') return '';
  let parsed = new DOMParser().parseFromString(html, 'text/html');
  if (!parsed) return fallbackSanitize(html);
  stripInlineEvents(parsed);
  stripHeavyStyles(parsed);
  return `<!DOCTYPE html>${parsed.documentElement.outerHTML}`;
}

function fallbackSanitize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, ' ')
    .replace(/<link[^>]+rel=["']?(?:preload|modulepreload|prefetch|prerender)["']?[^>]*>/gi, '')
    .replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/gi, ' ');
}

function createFrame(width) {
  const frame = document.createElement('iframe');
  Object.assign(frame.style, {
    width: `${width}px`,
    height: '100px',
    visibility: 'hidden',
    position: 'absolute',
    left: '-9999px',
    top: '0',
    pointerEvents: 'none'
  });
  frame.setAttribute('sandbox', 'allow-same-origin');
  document.body.appendChild(frame);
  return frame;
}

const removeFrame = frame => frame?.parentNode?.removeChild(frame);

const writeFrameHtml = (frame, html) => {
  frame.srcdoc = html;
  return frame.contentDocument || frame.contentWindow?.document;
};

const waitForLoad = frame => new Promise(res => {
  let done = false;
  const timer = setTimeout(() => (!done && (done = true, res())), 8000);
  frame.onload = () => { if (!done) { done = true; clearTimeout(timer); res(); } };
});

const raf = () => new Promise(r => requestAnimationFrame(r));

async function settleFonts(doc) {
  if (doc.fonts?.ready) await doc.fonts.ready;
}

const haltPendingLoads = doc => {
  const root = doc.documentElement;
  if (root?.innerHTML) root.innerHTML = root.innerHTML;
};

const computePageHeight = doc => Math.max(
  doc.documentElement?.scrollHeight || 0,
  doc.body?.scrollHeight || 0,
  MAX_CAPTURE_HEIGHT
);

const clampHeight = h => Math.min(h || MAX_CAPTURE_HEIGHT, MAX_CAPTURE_HEIGHT);

const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r) : setTimeout(r, 16)));

async function renderCanvas(doc, width, height) {
  const factory = ensureHtml2Canvas();
  const opts = {
    backgroundColor: '#fff',
    useCORS: true,
    allowTaint: false,
    scale: CAPTURE_SCALE,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    foreignObjectRendering: true,
    imageTimeout: 1500,
    logging: false
  };
  return factory(doc.documentElement, opts);
}

function downscaleCanvas(canvas, scale) {
  if (!canvas || scale >= 1) return canvas;
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  const output = document.createElement('canvas');
  output.width = w; output.height = h;
  const ctx = output.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, w, h);
  canvas.width = canvas.height = 0;
  return output;
}

async function exportCanvasBlob(canvas) {
  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej()), EXPORT_MIME, EXPORT_QUALITY);
  });
}

const deriveHost = url => {
  try { return new URL(url).hostname; } catch { return ''; }
};

async function captureSingle(url, options) {
  const { mode = 'desktop', cookie, onStatus } = options;
  notify(onStatus, `Capturing ${url}`);
  const html = await fetchSnapshot(url, cookie, onStatus);
  await idle();
  const width = computeViewportWidth(mode);
  const frame = createFrame(width);

  try {
    const doc = writeFrameHtml(frame, sanitizeHtml(html) || html);
    await waitForLoad(frame);
    await raf(); await raf();
    await settleFonts(doc);
    haltPendingLoads(doc);
    await idle();

    const height = clampHeight(computePageHeight(doc));
    frame.style.height = `${height}px`;

    const rawCanvas = await renderCanvas(doc, width, height);
    await idle();

    const scaledCanvas = downscaleCanvas(rawCanvas, OUTPUT_SCALE);
    const blob = await exportCanvasBlob(scaledCanvas);
    const mime = blob.type || EXPORT_MIME;

    const title = doc.title || 'Captured page';
    scaledCanvas.width = scaledCanvas.height = 0;

    return {
      blob,
      meta: {
        host: deriveHost(url),
        pageUrl: url,
        pageTitle: title,
        mode,
        mime,
        dimensions: {
          width: scaledCanvas.width || width,
          height: scaledCanvas.height || height
        }
      }
    };
  } finally {
    removeFrame(frame);
  }
}

async function capturePages(options) {
  if (!options) throw new Error('No URLs for capture.');
  if (!Array.isArray(options.urls)) throw new Error('No URLs for capture.');
  if (options.urls.length === 0) throw new Error('No URLs for capture.');

  const mode = options.mode || 'desktop';
  const cookie = options.cookie;
  const onStatus = options.onStatus;
  const onCapture = options.onCapture;
  const total = options.urls.length;
  let index = 0;

  for (const entry of options.urls) {
    if (!entry) continue;
    index += 1;
    notify(onStatus, `Starting ${index}/${total}`);
    const trimmed = entry.trim();
    const result = await captureSingle(trimmed, { mode, cookie, onStatus });
    if (typeof onCapture === 'function') await onCapture(result);
    notify(onStatus, `Finished ${index}/${total}`);
    await idle();
  }
}

  const root = window;
  if (!root.ScreenshotCapture) {
    root.ScreenshotCapture = {};
  }
  root.ScreenshotCapture.capturePages = capturePages;
})();
