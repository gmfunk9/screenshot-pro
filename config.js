import path from 'path';

const BASE_DIR = path.dirname(new URL(import.meta.url).pathname);

const config = {
    server: {
        port: 3200
    },
    puppeteer: {
        headless: true,
        defaultViewport: { width: 1920, height: 1080 }
    },
    paths: {
        baseDir: BASE_DIR,
        screenshots: path.join(BASE_DIR, 'static', 'screenshots')
    }
};

export default config;
