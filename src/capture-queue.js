import { logger } from './logger.js';

const queue = [];
let active = 0;
const CONCURRENCY = 1;
const DEFAULT_TIMEOUT_MS = Number(process.env.CAPTURE_TASK_TIMEOUT_MS || 600000);

function runWithTimeout(task, timeoutMs) {
    if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return task();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Capture task timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([task(), timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function next() {
    if (active >= CONCURRENCY) return;
    const job = queue.shift();
    if (!job) return;
    active += 1;
    logger.debug('queue', 'Starting task', { active, queued: queue.length });
    const { task, resolve, reject, timeoutMs } = job;
    runWithTimeout(task, timeoutMs).then((result) => {
        active -= 1;
        logger.debug('queue', 'Task complete', { active, queued: queue.length });
        resolve(result);
        next();
    }).catch((error) => {
        active -= 1;
        logger.warn('queue', 'Task failed', { active, queued: queue.length, error: error.message });
        reject(error);
        next();
    });
}

export function enqueue(task, options = {}) {
    if (!task) throw new Error('Missing queue task.');
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject, timeoutMs });
        logger.debug('queue', 'Task enqueued', { active, queued: queue.length });
        next();
    });
}
