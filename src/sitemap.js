import fetch from 'node-fetch';
export async function fetchSitemap(url) {
    const response = await fetch(`https://getsitemap.funkpd.com/json?url=${url}`);
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
    return data.sitemap;
}
