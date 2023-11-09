import path from 'path';


const BASE_DIR = path.dirname(new URL(import.meta.url).pathname);


const config = {
    // Server configuration
    server: {
        port: 3200
    },

    // Puppeteer configuration
    puppeteer: {
        headless: true,
        defaultViewport: { width: 1920, height: 1080 }
    },

    // File paths
    paths: {
        baseDir: BASE_DIR,
        screenshots: path.join(BASE_DIR, "/static/screenshots/")
    },

    // Any other configuration settings can be added here
};

export default config;
