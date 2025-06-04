import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import config from '../config.js';
import { sitemapCacheDir } from './file.js';



export async function fetchSitemap(url) {
    const cacheDir = sitemapCacheDir();
    const cachePath = path.join(cacheDir, `${url.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);

    if (fs.existsSync(cachePath)) {
        const data = fs.readFileSync(cachePath, 'utf-8');
        return JSON.parse(data);
    }

    let response;
    try {
        response = await fetch(`https://getsitemap.funkpd.com/json?url=${url}`);
    } catch (err) {
        throw new Error(`Network request failed ${err.message}`);
    }

    if (!response.ok) {
        throw new Error(`Bad response ${response.status}`);
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('Failed to parse sitemap JSON');
    }

    if (!data.sitemap) {
        throw new Error('Missing sitemap in response');
    }

    if (data.sitemap.length === 0) {
        throw new Error('Empty sitemap');
    }

    fs.writeFileSync(cachePath, JSON.stringify(data));
    return data.sitemap;
}
