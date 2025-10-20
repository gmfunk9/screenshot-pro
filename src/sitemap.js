import fetch from 'node-fetch';

function readEntry(input) {
    if (!input) return '';
    const kind = typeof input;
    if (kind === 'string') {
        const trimmed = input.trim();
        if (trimmed) return trimmed;
        return '';
    }
    if (kind !== 'object') return '';
    const locValue = input.loc;
    const locMissing = typeof locValue === 'undefined';
    if (!locMissing) {
        const locString = String(locValue).trim();
        if (locString) return locString;
    }
    const urlValue = input.url;
    const urlMissing = typeof urlValue === 'undefined';
    if (!urlMissing) {
        const urlString = String(urlValue).trim();
        if (urlString) return urlString;
    }
    return '';
}

function absolutize(baseUrl, raw) {
    if (!raw) return '';
    try {
        const parsed = new URL(raw, baseUrl);
        const href = parsed.toString();
        const isHttp = parsed.protocol === 'http:';
        if (isHttp) return href;
        const isHttps = parsed.protocol === 'https:';
        if (isHttps) return href;
        return '';
    } catch (error) {
        return '';
    }
}

export function normalizeSitemapEntries(baseUrl, entries) {
    if (!entries) return [];
    let list = [];
    const arrayInput = Array.isArray(entries);
    if (arrayInput) {
        list = entries;
    } else {
        list = [entries];
    }
    const unique = new Set();
    for (const item of list) {
        const candidate = readEntry(item);
        if (!candidate) continue;
        const absolute = absolutize(baseUrl, candidate);
        if (!absolute) continue;
        const seen = unique.has(absolute);
        if (seen) continue;
        unique.add(absolute);
    }
    return Array.from(unique);
}

export async function fetchSitemap(url) {
    const response = await fetch(`https://getsitemap.funkpd.com/json?url=${url}`);
    if (!response.ok) {
        throw new Error(`Bad response ${response.status}`);
    }
    const data = await response.json();
    if (!data) {
        throw new Error('Missing sitemap in response');
    }
    const sitemap = data.sitemap;
    if (!sitemap) {
        throw new Error('Missing sitemap in response');
    }
    const urls = normalizeSitemapEntries(url, sitemap);
    if (!urls.length) {
        throw new Error('Empty sitemap');
    }
    return urls;
}
