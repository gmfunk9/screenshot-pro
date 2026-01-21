import fetch from 'node-fetch';

export async function fetchSitemap(url, { signal, onStatus } = {}) {
    const report = typeof onStatus === 'function' ? onStatus : null;
    const endpoint = `https://getsitemap.funkpd.com/json?url=${encodeURIComponent(url)}`;
    if (report) report(`Requesting sitemap: ${endpoint}`);
    const response = await fetch(endpoint, { signal });
    if (report) report(`Sitemap response: ${response.status}`);
    if (!response.ok) {
        throw new Error(`Bad response ${response.status}`);
    }
    const data = await response.json();
    if (!data.sitemap) {
        throw new Error('Missing sitemap in response');
    }
    if (data.sitemap.length === 0) {
        throw new Error('Empty sitemap');
    }
    if (report) report(`Sitemap parsed: ${data.sitemap.length} URLs`);
    return data.sitemap;
}
