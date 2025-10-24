const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
const SITEMAP_ENDPOINT = './sitemap-proxy.php';
const SITEMAP_PAGE_LIMIT = 10;

function createProxyUrl(url) {
    return `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;
}

async function fetchSnapshot(url) {
    const res = await fetch(createProxyUrl(url));
    if (!res.ok) throw new Error(`Proxy fetch failed (${res.status})`);
    return await res.text();
}

async function fetchSitemapUrls(baseUrl, statusEl) {
    const res = await fetch(`${SITEMAP_ENDPOINT}?url=${encodeURIComponent(baseUrl)}`);
    if (!res.ok) throw new Error(`Sitemap fetch failed (${res.status})`);
    const data = await res.json();
    let list = Array.isArray(data.sitemap) ? data.sitemap : [];
    if (list.length === 0) throw new Error('Empty sitemap');
    if (list.length > SITEMAP_PAGE_LIMIT) list = list.slice(0, SITEMAP_PAGE_LIMIT);
    appendStatus(statusEl, `✓ Sitemap ${list.length} url(s)`);
    return list;
}
