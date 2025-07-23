export function parseCookies(str, url) {
    if (!str) return [];
    const { hostname } = new URL(url);
    const cookiePath = '/';
    const cookies = [];
    for (const part of str.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const name = trimmed.slice(0, idx).trim();
        if (!name) continue;
        const value = trimmed.slice(idx + 1).trim();
        cookies.push({ name, value, domain: hostname, path: cookiePath });
    }
    return cookies;
}
