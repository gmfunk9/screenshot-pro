import { createGallery } from 'app/gallery';

const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
const SITEMAP_ENDPOINT = 'https://getsitemap.funkpd.com/json';
const FETCH_COOLDOWN_MS = 5000;
const IMAGE_TIMEOUT_MS = 5000;
const MAX_CAPTURE_HEIGHT = 6000;
const PREVIEW_SCALE = 0.25;
const EXPORT_MIME = 'image/webp';
const EXPORT_QUALITY = 0.7;

const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1920 };
const blobUrls = new Set();
let nextFetchReadyAt = 0;

const selectById = id => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
};

const writeStatus = (target, msg) => {
  if (!target) return;
  target.textContent = msg;
  target.scrollTop = target.scrollHeight;
};

const appendStatus = (target, msg, data) => {
  if (!target) return;
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${msg}`;
  console.log(line, data || '');
  target.textContent += `\n${line}`;
  target.scrollTop = target.scrollHeight;
};

const deriveHost = url => (url ? new URL(url).hostname : '');
const resolveViewportWidth = mode => VIEWPORTS[mode] || VIEWPORTS.desktop;

const disableForm = (form, disabled) => {
  Array.from(form.elements || []).forEach(c => (c.disabled = disabled));
};

const createProxyUrl = url => `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;
const wait = ms => new Promise(r => setTimeout(r, ms));
const raf = () => new Promise(r => requestAnimationFrame(r));

async function waitForNextFetchSlot(statusEl) {
  const now = Date.now();
  if (now < nextFetchReadyAt) {
    const waitMs = nextFetchReadyAt - now;
    appendStatus(statusEl, `→ Waiting ${waitMs}ms`);
    await wait(waitMs);
  }
}

async function fetchSnapshot(url, statusEl) {
  await waitForNextFetchSlot(statusEl);
  const proxyUrl = createProxyUrl(url);
  appendStatus(statusEl, '→ Fetching snapshot', { proxyUrl });
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Proxy fetch failed (${res.status})`);
  const html = await res.text();
  appendStatus(statusEl, '✓ HTML bytes', { length: html.length });
  return html;
}

function buildIframe(width) {
  const frame = document.createElement('iframe');
  Object.assign(frame.style, {
    width: `${width}px`,
    height: '100px',
    visibility: 'hidden',
    display: 'block',
    border: '0',
    position: 'absolute',
    left: '-10000px',
    top: '0',
    pointerEvents: 'none'
  });
  document.body.appendChild(frame);
  return frame;
}

const removeIframe = frame => frame?.parentNode?.removeChild(frame);

const writeHtmlIntoFrame = (frame, html) => {
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  return doc;
};

const freezeAnimations = doc => {
  const style = doc.createElement('style');
  style.textContent = `*,*::before,*::after{animation:none!important;transition:none!important}`;
  (doc.head || doc.documentElement).appendChild(style);
};

async function settleFonts(doc, statusEl) {
  if (doc.fonts?.ready) await doc.fonts.ready;
  appendStatus(statusEl, '✓ Fonts ready');
}

function computePageHeight(doc) {
  const root = doc.documentElement;
  const body = doc.body;
  return Math.max(
    root.scrollHeight,
    root.offsetHeight,
    body?.scrollHeight || 0,
    MAX_CAPTURE_HEIGHT
  );
}

const clampHeight = h => Math.min(h || MAX_CAPTURE_HEIGHT, MAX_CAPTURE_HEIGHT);

const ensureHtml2Canvas = () => window.html2canvas;

async function renderPage(doc, width, height, statusEl) {
  const html2canvas = ensureHtml2Canvas();
  const options = {
    backgroundColor: '#fff',
    useCORS: true,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scale: 1
  };
  appendStatus(statusEl, '→ Rendering', { width, height });
  const canvas = await html2canvas(doc.documentElement, { ...options, foreignObjectRendering: true });
  const scaled = document.createElement('canvas');
  scaled.width = Math.round(canvas.width * PREVIEW_SCALE);
  scaled.height = Math.round(canvas.height * PREVIEW_SCALE);
  const ctx = scaled.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  canvas.width = canvas.height = 0;

  return scaled;
}

async function exportCanvasBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject()), EXPORT_MIME, EXPORT_QUALITY)
  );
}

const createBlobUrl = blob => URL.createObjectURL(blob);

const releaseBlobUrls = () => {
  blobUrls.forEach(url => URL.revokeObjectURL(url));
  blobUrls.clear();
};

const scheduleFetchCooldown = statusEl => {
  nextFetchReadyAt = Date.now() + FETCH_COOLDOWN_MS;
  appendStatus(statusEl, `→ Cooling down ${FETCH_COOLDOWN_MS}ms`);
};

async function capturePage({ url, mode, width, statusEl, gallery, hasNext }) {
  appendStatus(statusEl, '→ Capture', { url, mode });
  const html = await fetchSnapshot(url, statusEl);
  const frame = buildIframe(width);
  try {
    const doc = writeHtmlIntoFrame(frame, html);
    freezeAnimations(doc);
    await raf(); await raf();
    await settleFonts(doc, statusEl);
    const rawHeight = computePageHeight(doc);
    const captureHeight = clampHeight(rawHeight);
    const canvas = await renderPage(doc, width, captureHeight, statusEl);
    const blob = await exportCanvasBlob(canvas);
    const blobUrl = createBlobUrl(blob);
    blobUrls.add(blobUrl);
    gallery.append({
      host: deriveHost(url),
      mode,
      pageUrl: url,
      imageUrl: blobUrl,
      blob,
      dimensions: { width: canvas.width, height: canvas.height },
      mime: blob.type
    });
    canvas.width = canvas.height = 0;
    appendStatus(statusEl, '✓ Done', { url });
    if (hasNext) scheduleFetchCooldown(statusEl);
  } finally {
    removeIframe(frame);
  }
}

async function fetchSitemapUrls(baseUrl, statusEl) {
  const endpoint = `${SITEMAP_ENDPOINT}?url=${encodeURIComponent(baseUrl)}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Sitemap fetch failed (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.sitemap) ? data.sitemap : [];
  if (!list.length) throw new Error('Empty sitemap');
  appendStatus(statusEl, '✓ Sitemap loaded', { count: list.length });
  return list;
}

function parseUrlInput(raw) {
  const urls = raw.trim().split(/\s+/);
  return [...new Set(urls.filter(u => /^https?:\/\//i.test(u)))];
}

async function collectSitemapUrls(raw, statusEl) {
  const bases = parseUrlInput(raw);
  const urls = [];
  for (const base of bases) {
    const entries = await fetchSitemapUrls(base, statusEl);
    urls.push(...entries.filter(u => /^https?:\/\//i.test(u)));
  }
  appendStatus(statusEl, '✓ URLs collected', { total: urls.length });
  return urls;
}

async function handleCapture(form, urlInput, modeInputs, statusEl, gallery) {
  disableForm(form, true);
  writeStatus(statusEl, '');
  const urls = await collectSitemapUrls(urlInput.value, statusEl);
  const mode = Array.from(modeInputs).find(r => r.checked)?.value || 'desktop';
  const width = resolveViewportWidth(mode);
  for (let i = 0; i < urls.length; i++) {
    const hasNext = i < urls.length - 1;
    await capturePage({ url: urls[i], mode, width, statusEl, gallery, hasNext });
  }
  disableForm(form, false);
}

function init() {
  const form = selectById('capture-form');
  const urlInput = selectById('urlInput');
  const statusEl = selectById('sessionStatus');
  const galleryContainer = selectById('result');
  const newSessionBtn = selectById('newSessionBtn');
  const clearGalleryBtn = selectById('clearGalleryBtn');
  const modeInputs = document.querySelectorAll('input[name="mode"]');
  const gallery = createGallery(galleryContainer);

  writeStatus(statusEl, 'Idle. Ready.');

  newSessionBtn.onclick = () => {
    releaseBlobUrls();
    gallery.clear();
    writeStatus(statusEl, 'Session reset.');
  };

  clearGalleryBtn.onclick = () => {
    releaseBlobUrls();
    gallery.clear();
    writeStatus(statusEl, 'Gallery cleared.');
  };

  form.onsubmit = async e => {
    e.preventDefault();
    await handleCapture(form, urlInput, modeInputs, statusEl, gallery);
  };
}

window.addEventListener('beforeunload', releaseBlobUrls);
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
