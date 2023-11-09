import fetch from 'node-fetch';

// Retrieve a sitemap for a given URL
async function fetchSitemap(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`There was a problem fetching the sitemap: ${error.message}`);
        return null;
    }
}

export { fetchSitemap };
