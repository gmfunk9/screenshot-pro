const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
const SITEMAP_ENDPOINT = './sitemap-proxy.php';
const SITEMAP_PAGE_LIMIT = 10;
function dedupeUrls(urls) {
    const seen = new Set();
    const uniqueUrls = [];
    for (const item of urls) {
        if (typeof item !== 'string') {
            continue;
        }
        const trimmed = item.trim();
        if (trimmed === '') {
            continue;
        }
        if (seen.has(trimmed)) {
            continue;
        }
        seen.add(trimmed);
        uniqueUrls.push(trimmed);
    }
    return uniqueUrls;
}
function createProxyUrl(targetUrl) {
    const encodedUrl = encodeURIComponent(targetUrl);
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodedUrl}`;
    return proxyUrl;
}
async function fetchSnapshot(targetUrl) {
    const proxyUrl = createProxyUrl(targetUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Proxy fetch failed (${response.status})`);
    }
    const htmlContent = await response.text();
    return htmlContent;
}
async function fetchSitemapUrls(baseUrl, statusElement) {
    const encodedBaseUrl = encodeURIComponent(baseUrl);
    const sitemapUrl = `${SITEMAP_ENDPOINT}?url=${encodedBaseUrl}`;
    const response = await fetch(sitemapUrl);
    if (!response.ok) {
        throw new Error(`Sitemap fetch failed (${response.status})`);
    }
    const responseData = await response.json();
    let sitemapList;
    if (Array.isArray(responseData.sitemap)) {
        sitemapList = responseData.sitemap;
    } else {
        sitemapList = [];
    }
    if (sitemapList.length === 0) {
        throw new Error('Empty sitemap');
    }
    let limitedSitemapList = sitemapList;
    if (sitemapList.length > SITEMAP_PAGE_LIMIT) {
        limitedSitemapList = sitemapList.slice(0, SITEMAP_PAGE_LIMIT);
    }
    const dedupedList = dedupeUrls(limitedSitemapList);
    const urlCount = dedupedList.length;
    appendStatus(statusElement, `✓ Sitemap ${urlCount} url(s)`);
    return dedupedList;
}
