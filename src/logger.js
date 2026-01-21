const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

function resolveLevel() {
    const raw = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';
    if (Object.hasOwn(LEVELS, raw)) return raw;
    return 'info';
}

function formatMeta(meta) {
    if (!meta) return '';
    try {
        return ` ${JSON.stringify(meta)}`;
    } catch (error) {
        return ` ${String(meta)}`;
    }
}

const listeners = new Set();

function write(level, scope, message, meta) {
    const now = new Date().toISOString();
    const label = level.toUpperCase();
    const safeScope = scope ? `[${scope}]` : '';
    const line = `[${now}] ${label} ${safeScope} ${message}${formatMeta(meta)}`;
    if (level === 'error') {
        console.error(line);
    } else {
        console.log(line);
    }
    if (listeners.size) {
        const payload = { level, scope, message, meta, time: now };
        for (const listener of listeners) {
            try {
                listener(payload);
            } catch {}
        }
    }
}

const CURRENT_LEVEL = resolveLevel();

export function log(level, scope, message, meta) {
    const threshold = LEVELS[CURRENT_LEVEL];
    const severity = LEVELS[level] ?? LEVELS.info;
    if (severity < threshold) return;
    write(level, scope, message, meta);
}

export const logger = {
    debug: (scope, message, meta) => log('debug', scope, message, meta),
    info: (scope, message, meta) => log('info', scope, message, meta),
    warn: (scope, message, meta) => log('warn', scope, message, meta),
    error: (scope, message, meta) => log('error', scope, message, meta)
};

export function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
}
