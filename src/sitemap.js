import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import config from '../config.js';
import { sitemapCacheDir } from './file.js';



export async function fetchSitemap(url) {
    console.log("FETCHSITEMAP:" + url);
    const cacheDir  = sitemapCacheDir();
    const cachePath = path.join(cacheDir, `${url.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);

    // Check if sitemap exists in cache
    if (fs.existsSync(cachePath)) {
        console.log("Using cached sitemap");
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }

    
    const response = await fetch(`https://getsitemap.funkpd.com/json?url=${url}`);
    const sitemapData = await response.json();

    if (!sitemapData || !sitemapData.sitemap || sitemapData.sitemap.length === 0) {
        throw new Error('No URLs found in sitemap');
    }

    // Save sitemap to cache
    fs.writeFileSync(cachePath, JSON.stringify(sitemapData));

    return sitemapData.sitemap;
}
