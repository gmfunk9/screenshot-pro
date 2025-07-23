export function parseCookies(name, value, url) {
    if (!name || !value) return [];
    const { hostname } = new URL(url);
    return [{ name, value, domain: hostname, path: '/' }];
}
