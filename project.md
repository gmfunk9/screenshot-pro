
# ./config.js
```js
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
```

# ./index.js
```js
import express from 'express';
import { setupRoutes } from './src/routes.js';
import config from './config.js';
import { requestLogger, errorHandler } from './src/middleware.js';

const app = express();

// Middlewares
app.use(express.json());
app.use(requestLogger);  // Use the request logging middleware

// Setup routes
setupRoutes(app);

// Error handler middleware (should be after all other middlewares/routes)
app.use(errorHandler);

// Start the server
app.listen(config.server.port, () => {
	console.log(`Server is running on port ${config.server.port}`);
});
```

# ./src/constants.js
```js
// HTTP Status Codes
const HTTP_STATUS = {
	OK: 200,
	BAD_REQUEST: 400,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500
};

// Error messages
const ERROR_MESSAGES = {
	GENERIC_ERROR: "An error occurred. Please try again later.",
	NOT_FOUND: "Resource not found."
};

// Any other constant values can be added here

export { HTTP_STATUS, ERROR_MESSAGES };
```

# ./src/file.js
```js
import fs from 'fs';
import path from 'path';
import config from '../config.js';

// Determine file paths for saving screenshots using URL's domain and filename
function generateFilePaths(url) {
	const host = new URL(url).hostname.replace(/\./g, '_');
	const pathSegments = new URL(url).pathname.replace(/\//g, '_');
	const sanitizedPath = pathSegments.replace(/^_+|_+$/g, '') || 'home';
	const screenshotsDir = path.join(config.paths.screenshots, host);
	const finalFilePath = path.join(screenshotsDir, `${sanitizedPath}.jpg`);

	const relativePath = `/static/screenshots/${host}/${sanitizedPath}.jpg`;

	// Ensure the cache directory exists
	if (!fs.existsSync(screenshotsDir)) {
	  fs.mkdirSync(screenshotsDir);
	}
  
	return { screenshotsDir, finalFilePath, relativePath};
  }
  

// Check for the existence of a screenshot at a given file path
function screenshotExists(filepath) {
	return fs.existsSync(filepath);
}
function sitemapCacheDir(filepath) {

	const SITEMAP_CACHE_DIR = path.resolve(config.paths.baseDir, 'assets/sitemap-cache');

	// Ensure the cache directory exists
	if (!fs.existsSync(SITEMAP_CACHE_DIR)) {
	    fs.mkdirSync(SITEMAP_CACHE_DIR);
	}

	return SITEMAP_CACHE_DIR;
}




export { generateFilePaths, screenshotExists, sitemapCacheDir };
```

# ./src/middleware.js
```js
import { ERROR_MESSAGES } from './constants.js';

// Middleware for logging incoming requests
function requestLogger(req, res, next) {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
	next();
}

// Middleware for handling errors
function errorHandler(err, req, res, next) {
	console.error(err.stack); // This line logs the error details
	res.status(500).json({ error: ERROR_MESSAGES.GENERIC_ERROR });
}


export { requestLogger, errorHandler };
```

# ./src/network.js
```js
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
```

# ./src/routes.js
```js
import path from 'path';
import express from 'express';
import { fetchSitemap } from './sitemap.js';
import { captureDesktopScreenshot } from './screenshot.js';
import config from '../config.js';

const router = express.Router();

// Array to keep track of SSE clients
const clients = [];

router.post('/capture', captureImage);
router.get('/stream', sseStream);
router.use('/static', express.static(path.join(config.paths.baseDir, 'static')));
router.get('/', serveMainUI);

async function captureImage(req, res, next) {
	const { url } = req.body;
	try {
	    const sitemapResponse = await fetchSitemap(url);

	    if (!sitemapResponse.success || !Array.isArray(sitemapResponse.sitemap)) {
	        return res.status(400).json({ error: "Failed to fetch or process sitemap" });
	    }

	    const results = await Promise.all(
	        sitemapResponse.sitemap.map(siteUrl => processSiteUrl(siteUrl))
	    );

	    res.json({ success: true, results });
	} catch (error) {
	    next(error);
	}
}

async function processSiteUrl(siteUrl) {
	const imageData = await captureDesktopScreenshot(siteUrl);
	broadcastToClients(imageData);
	return imageData;
}

function broadcastToClients(data) {
	clients.forEach(client => {
	    client.write(`data: ${JSON.stringify({ imageData: data })}\n\n`);
	});
}

function sseStream(req, res) {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	const pingInterval = setInterval(() => res.write('data:{"type": "ping"}\n\n'), 1000);
	clients.push(res);

	req.on('close', () => {
	    clearInterval(pingInterval);
	    const index = clients.indexOf(res);
	    if (index !== -1) {
	        clients.splice(index, 1);
	    }
	});
}

function serveMainUI(req, res) {
	res.sendFile(path.join(config.paths.baseDir, 'static/index.html'));
}

export function setupRoutes(app) {
	app.use('/', router);
}
```

# ./src/screenshot.js
```js
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import path from 'path';
import { generateFilePaths, screenshotExists } from './file.js';

// Capture and save a screenshot using Puppeteer
async function _takeScreenshot(url) {
	console.log("START: takeScreenshot");
	const { screenshotsDir, finalFilePath, relativePath} = generateFilePaths(url);
	console.log("FILE:" + finalFilePath);
	console.log("URL :" + url);
	
	if (screenshotExists(finalFilePath)) {
	    console.log("exists:" + finalFilePath);
	    return { status: 'exists', filepath: finalFilePath, relativePath: relativePath };
	}
	console.log("!exists:" + finalFilePath);

	const browser = await puppeteer.launch({ headless: "new" });
	console.log("launch:");
	const page = await browser.newPage();
	console.log("newPage:");
	await page.goto(url);
	console.log("goto:");
	const screenshotBuffer = await page.screenshot({ path: finalFilePath, fullPage: true });
	await browser.close();
	
	console.log("captured:" + finalFilePath);
	return { status: 'captured', filepath: finalFilePath, relativePath: relativePath };

}

// Retrieve the dimensions of an image
async function _getImageDimensions(imagePath) {
	const { width, height } = await sharp(imagePath).metadata();
	return { width, height };
}

// A higher-level function that captures, processes, and returns screenshot details
async function captureDesktopScreenshot(url) {
	console.log("START: captureDesktopScreenshot");
	const { status, filepath, relativePath } = await _takeScreenshot(url);
	console.log("GGG " );
	console.log("status " + status);
	console.log("filepath " + filepath);
	if (status === 'exists' || status === 'captured') {
	    const { width, height } = await _getImageDimensions(filepath);
	    console.log("return CDS ");
	    return {
	        status,
	        relativePath,
	        dimensions: { width, height }
	    };
	}
	return { status: 'error' };
}

export { captureDesktopScreenshot };
```

# ./src/sitemap.js
```js
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
```

# ./static/card.html
```html
<article class="image-wrap">
	<img src="#" alt="Screenshot" class="screenshot-img">
	<div class="actions">
	    <button class="view-page-btn">View Page</button>
	    <button class="view-image-btn">View Image</button>
	</div>
</article>
```

# ./static/css/style.css
```css
/* For Chrome, Safari, and newer versions of Opera */
::-webkit-scrollbar {width: 6px;height: 3px;}
::-webkit-scrollbar-track {background: transparent;}
::-webkit-scrollbar-thumb {background: black;}

/* For Firefox */
* {scrollbar-width: thin;scrollbar-color: black transparent;}



body {
	margin: 0;
	padding: 0;
	overflow: hidden;
}
header {
	height: 12vh;
	outline: 2px solid #000;
	overflow: hidden;
	padding: 0;
}
main {
	height: 88vh;
	padding-left: 10px;
}
#header_one {
	margin-right: auto;
}

#gallery {
	display: flex;
/*     width: calc(100% - 50px); */
	padding-block: 20px;
	overflow-x: hidden;
}
#result {
	cursor: grab;
	width: max-content;
	transform: translate3d(0, 0, 0);
	will-change: transform;
}

#result.grabbing {
	cursor: grabbing;
}



[class*="flex-"]{
	display: flex;
	flex-wrap: nowrap;
}
.flex-row {
	flex-direction: row;
}
.flex-col {
	flex-direction: column;
}
.flex-gap {
	gap:30px;
}
.flex-center {
	place-items: center;
	place-content: center;
}
.flex-wrap {
	flex-wrap: wrap;
}

.card {
	flex-shrink: 0;
	width:100%;
	max-width:33vw;
	/* height: 100%; */

	max-height: 80vh;
	overflow: hidden auto;
	
	border-radius: 8px;
	border: 1px solid #000;
	box-shadow: 8px 8px #000;
}
.card img {
	display: block;
	width: 100%;
	background-color: #f5f5f5;
	object-fit: cover;
	object-position: top;
}


@media (orientation: landscape) {
	#captureForm {
	    flex-direction: row;
	}
}
	```

# ./static/index.html
```html
<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Screenshot Capture</title>
	<link rel="stylesheet" href="static/css/style.css">
</head>

<body>
	<header>
	    <form id="capture-form">
	        <input type="url" id="urlInput" value="https://funkpd.com/" placeholder="Enter URL...">
	        <button type="submit">Capture Screenshot</button>
	    </form>
	</header>
	<main id="gallery">
	    <section id="result" class="flex-row flex-gap">

	        <article class="image-wrap">
	            <img src="static/img/placeholder.png" alt="Screenshot" class="screenshot-img" width="320" height="500">
	            <div class="actions">
	                <button class="view-page-btn">View Page</button>
	                <button class="view-image-btn">View Image</button>
	            </div>
	        </article>    
	                
	    </section>
	</main>
	<script src="/static/js/main.js"></script>
	<script src="/static/js/fpgrab.js"></script>
</body>

</html>
```

# ./static/js/fpgrab.js
```js
class GrabController {
	constructor(container) {
	    this.isDragging = false;
	    this.initialX = 0;
	    this.currentTransform = 0;
	    this.container = container;
	    this.lastX = 0;
	    this.momentum = 0;
	    this.friction = 0.97;
	    this.allContentLoaded = false;
	    this.currentPage = 1; 
	    this.isFetching = false;
	    this.containerWidth = this.container.scrollWidth;
	    this.viewportWidth = window.innerWidth;

	    this.initEventListeners();
	    requestAnimationFrame(this.applyMomentum.bind(this));
	}

	initEventListeners() {
	    this.container.addEventListener('mousedown', this.startDrag.bind(this));
	    document.addEventListener('mousemove', this.handleDrag.bind(this));
	    document.addEventListener('mouseup', this.endDrag.bind(this));
	    window.addEventListener('blur', this.onWindowBlur.bind(this));
	    window.addEventListener('focus', this.onWindowFocus.bind(this));
	}

	onWindowBlur() {
	    this.endDrag();
	}

	onWindowFocus() {
	    this.lastX = 0;
	    this.momentum = 0;
	}

	startDrag(e) {
	    this.isDragging = true;
	    this.container.classList.add('grabbing');
	    this.initialX = e.pageX;
	    this.lastX = this.initialX;
	    this.lastTime = Date.now();
	    this.momentum = 0;
	    e.preventDefault();
	}

	handleDrag(e) {
	    if (!this.isDragging) return;
	    const currentX = e.pageX;
	    const currentTimestamp = Date.now();
	    const timeDifference = currentTimestamp - this.lastTime;

	    if (timeDifference) {
	        const distanceMoved = this.lastX - currentX;
	        this.momentum += (distanceMoved * 1) / timeDifference;
	        this.lastX = currentX;
	        this.lastTime = currentTimestamp;
	    }
	}

	endDrag(e) {
	    this.isDragging = false;
	    this.container.classList.remove('grabbing');
	}

	updateDimensions() {
	    this.containerWidth = this.container.scrollWidth;
	    this.viewportWidth = window.innerWidth;
	}

	clampTransform() {
	    const maxTransform = this.containerWidth - this.viewportWidth;
	    this.currentTransform = Math.min(Math.max(this.currentTransform, 0), maxTransform);
	}

	applyMomentum() {
	    this.currentTransform += this.momentum;
	    this.momentum *= this.friction;

	    if (Math.abs(this.momentum) < 0.1) {
	        this.momentum = 0;
	    }

	    this.clampTransform();
	    this.container.style.transform = `translate3d(-${this.currentTransform}px, 0, 0)`;
	    requestAnimationFrame(this.applyMomentum.bind(this));
	}
}

class CustomScroller {
	constructor() {
	    console.log("GRAB")
	    const container = document.querySelector('#result');
	    this.grabController = new GrabController(container);
	    console.log(container)

	    // Initialize the MutationObserver
	    this.observer = new MutationObserver(this.handleDOMChanges.bind(this));
	    this.observer.observe(container, {
	        childList: true,
```

# ./static/js/main.js
```js
document.addEventListener("DOMContentLoaded", function() {
	const captureForm = document.getElementById("capture-form");
	const urlInput = document.getElementById("urlInput");
	const gallery = document.getElementById("gallery");
	const result = document.getElementById("result");
	const templateImageWrap = document.querySelector(".image-wrap");
	let eventSource;

	captureForm.addEventListener("submit", async (event) => {
	    event.preventDefault();
	    
	    const url = urlInput.value;
	    if (!url) return;

	    // Start listening to the stream
	    startListening();

	    // Initiate the capture
	    try {
	        await fetch('/capture', {
	            method: 'POST',
	            headers: {
	                'Content-Type': 'application/json'
	            },
	            body: JSON.stringify({ url })
	        });
	    } catch (error) {
	        console.error("Failed to communicate with server:", error);
	    }
	});

	function startListening() {
	    if (eventSource) {
	        eventSource.close();
	    }

	    eventSource = new EventSource('/stream');
	    
	    eventSource.onmessage = (event) => {
	        const data = JSON.parse(event.data);

	        if (data.type && data.type === "ping") {
	            return;
	        }

	        if (data.imageData.relativePath) {
	            displayScreenshot(data.imageData.relativePath, data.imageData.dimensions);
	        }
	    };

	    eventSource.onerror = (error) => {
	        console.error("EventSource failed:", error);
	        eventSource.close();
	    };
	}

	function displayScreenshot(filepath, dimensions) {
	    // Clone the template
	    const clonedImageWrap = templateImageWrap.cloneNode(true);
	    
	    const img = clonedImageWrap.querySelector(".screenshot-img");
	    img.src = filepath;
	    img.alt = "Captured Screenshot";
	
	    // Adjusting width and height attributes
	    if (dimensions && dimensions.width && dimensions.height) {
	        img.width = dimensions.width;
	        img.height = dimensions.height;
	    }
	
	    // Adjusting the action buttons if needed (you can modify this part further as per requirements)
	    const viewPageBtn = clonedImageWrap.querySelector(".view-page-btn");
	    viewPageBtn.addEventListener('click', () => {
	        window.open(filepath, '_blank');
	    });
	
	    const viewImageBtn = clonedImageWrap.querySelector(".view-image-btn");
	    viewImageBtn.addEventListener('click', () => {
	        window.open(filepath, '_blank');
	    });
	
	    result.appendChild(clonedImageWrap);
	}
	
});
```
