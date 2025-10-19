const queue = [];
let active = 0;
const CONCURRENCY = 2;

function next() {
    if (active >= CONCURRENCY) return;
    const job = queue.shift();
    if (!job) return;
    active += 1;
    const { task, resolve, reject } = job;
    task().then((result) => {
        active -= 1;
        resolve(result);
        next();
    }).catch((error) => {
        active -= 1;
        reject(error);
        next();
    });
}

export function enqueue(task) {
    if (!task) throw new Error('Missing queue task.');
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        next();
    });
}
