const cache = {};

export function handleRequestInterception(req) {
    const url = req.url();
    const type = req.resourceType();
    const fromCache = (type === 'stylesheet' || type === 'script') && cache[url];
    if (fromCache) {
        req.respond({ status: 200, body: cache[url] });
        return;
    }
    req.continue();
}

export async function cacheAssets(page) {
    await page.setRequestInterception(true);
    page.on('request', handleRequestInterception);
    page.on('response', async (res) => {
        const url = res.url();
        const type = res.request().resourceType();
        if (type !== 'stylesheet' && type !== 'script') return;
        try {
            const buffer = await res.buffer();
            cache[url] = buffer;
        } catch {}
    });
}
