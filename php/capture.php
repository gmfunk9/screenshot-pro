<?php

declare(strict_types=1);

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/session.php';

const SITEMAP_ENDPOINT = 'https://getsitemap.funkpd.com/json';

function capture_session_state(): array
{
    $sessionDir = session_path();
    $sessionId = basename($sessionDir);
    $images = list_images();
    $result = [];
    foreach ($images as $entry) {
        $host = '';
        if (isset($entry['host'])) {
            if (is_string($entry['host'])) {
                $host = $entry['host'];
            }
        }
        $slug = sanitize_host($host);
        $relative = '/static/screenshots/' . $sessionId;
        if ($slug !== '') {
            $relative .= '/' . $slug;
        }
        $filename = '';
        if (isset($entry['filename'])) {
            if (is_string($entry['filename'])) {
                $filename = $entry['filename'];
            }
        }
        if ($filename === '') {
            continue;
        }
        $relative .= '/' . $filename;
        $meta = [];
        if (isset($entry['meta'])) {
            if (is_array($entry['meta'])) {
                $meta = $entry['meta'];
            }
        }
        $pageUrl = '';
        if (isset($meta['pageUrl'])) {
            if (is_string($meta['pageUrl'])) {
                $pageUrl = $meta['pageUrl'];
            }
        }
        $pageTitle = 'Captured page';
        if (isset($meta['pageTitle'])) {
            if (is_string($meta['pageTitle'])) {
                $pageTitle = $meta['pageTitle'];
            }
        }
        $mode = 'desktop';
        if (isset($meta['mode'])) {
            if (is_string($meta['mode'])) {
                $mode = $meta['mode'];
            }
        }
        $dimensions = ['width' => 0, 'height' => 0];
        if (isset($meta['dimensions'])) {
            if (is_array($meta['dimensions'])) {
                $dimensions = $meta['dimensions'];
            }
        }
        $sourceDimensions = ['width' => 0, 'height' => 0];
        if (isset($meta['sourceDimensions'])) {
            if (is_array($meta['sourceDimensions'])) {
                $sourceDimensions = $meta['sourceDimensions'];
            }
        }
        $mime = '';
        if (isset($meta['mime'])) {
            if (is_string($meta['mime'])) {
                $mime = $meta['mime'];
            }
        }
        $result[] = [
            'host' => $host,
            'imageUrl' => $relative,
            'pageUrl' => $pageUrl,
            'pageTitle' => $pageTitle,
            'mode' => $mode,
            'dimensions' => $dimensions,
            'sourceDimensions' => $sourceDimensions,
            'mime' => $mime
        ];
    }
    return [
        'session' => session_summary(),
        'images' => $result
    ];
}

function capture_handle_sitemap(): void
{
    $url = '';
    if (isset($_GET['url'])) {
        $url = trim((string) $_GET['url']);
    }
    if ($url === '') {
        respond_error(400, 'Missing field url; add to query.');
        return;
    }
    $endpoint = SITEMAP_ENDPOINT . '?url=' . rawurlencode($url);
    $context = stream_context_create([
        'http' => [
            'timeout' => 15,
            'header' => "User-Agent: ScreenshotProPHP\r\n"
        ]
    ]);
    $raw = @file_get_contents($endpoint, false, $context);
    if ($raw === false) {
        respond_error(502, 'Sitemap fetch failed; remote unreachable.');
        return;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond_error(502, 'Sitemap response invalid JSON.');
        return;
    }
    $list = [];
    if (isset($decoded['sitemap'])) {
        $entries = $decoded['sitemap'];
        if (is_array($entries)) {
            foreach ($entries as $entry) {
                if (!is_string($entry)) {
                    continue;
                }
                $trimmed = trim($entry);
                if ($trimmed === '') {
                    continue;
                }
                $list[] = $trimmed;
            }
        }
    }
    if (empty($list)) {
        respond_error(404, 'Sitemap returned no URLs.');
        return;
    }
    respond_json(200, ['urls' => $list]);
}

function capture_handle_proxy(): void
{
    $url = '';
    if (isset($_GET['url'])) {
        $url = trim((string) $_GET['url']);
    }
    if ($url === '') {
        respond_error(400, 'Missing field url; add to query.');
        return;
    }
    $cookie = '';
    if (isset($_GET['cookie'])) {
        $cookie = trim((string) $_GET['cookie']);
    }
    $options = [
        'http' => [
            'timeout' => 20,
            'header' => "User-Agent: ScreenshotProPHP\r\n"
        ]
    ];
    if ($cookie !== '') {
        $options['http']['header'] .= 'Cookie: ' . $cookie . "\r\n";
    }
    $context = stream_context_create($options);
    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        respond_error(502, 'Proxy fetch failed; remote unreachable.');
        return;
    }
    header('Content-Type: text/html; charset=UTF-8');
    echo $raw;
}

function image_extension_from_mime(string $mime): string
{
    if ($mime === 'image/png') {
        return 'png';
    }
    if ($mime === 'image/jpeg') {
        return 'jpg';
    }
    if ($mime === 'image/jpg') {
        return 'jpg';
    }
    if ($mime === 'image/webp') {
        return 'webp';
    }
    return 'png';
}

function write_metadata(string $path, array $meta): bool
{
    $json = json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }
    $written = file_put_contents($path, $json);
    if ($written === false) {
        return false;
    }
    return true;
}

function capture_handle_store(): void
{
    if (!isset($_FILES['image'])) {
        respond_error(400, 'Missing field image; add to body.');
        return;
    }
    $file = $_FILES['image'];
    if (!is_array($file)) {
        respond_error(400, 'Invalid field image; expected upload array.');
        return;
    }
    $errorCode = 0;
    if (isset($file['error'])) {
        $errorCode = (int) $file['error'];
    }
    if ($errorCode !== UPLOAD_ERR_OK) {
        if ($errorCode === UPLOAD_ERR_NO_FILE) {
            respond_error(400, 'Missing field image; add to body.');
            return;
        }
        respond_error(400, 'Image upload failed; check payload.');
        return;
    }
    $tmpPath = '';
    if (isset($file['tmp_name'])) {
        $tmpPath = (string) $file['tmp_name'];
    }
    if ($tmpPath === '') {
        respond_error(400, 'Uploaded image missing tmp path.');
        return;
    }
    if (!is_uploaded_file($tmpPath)) {
        respond_error(400, 'Uploaded image invalid; not a file upload.');
        return;
    }
    $binary = file_get_contents($tmpPath);
    if ($binary === false) {
        respond_error(500, 'Failed to read uploaded image from disk.');
        return;
    }
    if ($binary === '') {
        respond_error(400, 'Uploaded image empty; send valid file.');
        return;
    }
    $pageUrl = '';
    if (isset($_POST['pageUrl'])) {
        $pageUrl = trim((string) $_POST['pageUrl']);
    }
    if ($pageUrl === '') {
        respond_error(400, 'Missing field pageUrl; add to body.');
        return;
    }
    $host = '';
    if (isset($_POST['host'])) {
        $host = trim((string) $_POST['host']);
    }
    if ($host === '') {
        $parsed = parse_url($pageUrl, PHP_URL_HOST);
        if (is_string($parsed)) {
            $host = $parsed;
        }
    }
    if ($host === '') {
        respond_error(400, 'Missing host; supply host or valid URL.');
        return;
    }
    $mode = 'desktop';
    if (isset($_POST['mode'])) {
        $candidate = trim((string) $_POST['mode']);
        if ($candidate !== '') {
            $mode = $candidate;
        }
    }
    $title = 'Captured page';
    if (isset($_POST['pageTitle'])) {
        $candidate = trim((string) $_POST['pageTitle']);
        if ($candidate !== '') {
            $title = $candidate;
        }
    }
    $width = 0;
    if (isset($_POST['width'])) {
        $width = (int) $_POST['width'];
        if ($width < 0) {
            $width = 0;
        }
    }
    $height = 0;
    if (isset($_POST['height'])) {
        $height = (int) $_POST['height'];
        if ($height < 0) {
            $height = 0;
        }
    }
    $dimensions = ['width' => $width, 'height' => $height];
    $sourceWidth = 0;
    if (isset($_POST['sourceWidth'])) {
        $sourceWidth = (int) $_POST['sourceWidth'];
        if ($sourceWidth < 0) {
            $sourceWidth = 0;
        }
    }
    $sourceHeight = 0;
    if (isset($_POST['sourceHeight'])) {
        $sourceHeight = (int) $_POST['sourceHeight'];
        if ($sourceHeight < 0) {
            $sourceHeight = 0;
        }
    }
    $sourceDimensions = ['width' => $sourceWidth, 'height' => $sourceHeight];
    $mime = '';
    if (isset($_POST['mime'])) {
        $mime = strtolower(trim((string) $_POST['mime']));
    }
    if ($mime === '') {
        if (isset($file['type'])) {
            $mime = strtolower(trim((string) $file['type']));
        }
    }
    if ($mime === '') {
        $mime = 'image/webp';
    }
    $sessionDir = session_path();
    $slug = sanitize_host($host);
    $targetDir = $sessionDir;
    if ($slug !== '') {
        $targetDir = $sessionDir . DIRECTORY_SEPARATOR . $slug;
    }
    ensure_directory($targetDir);
    $basename = new_session_id();
    $extension = image_extension_from_mime($mime);
    if ($extension === '') {
        $extension = 'webp';
    }
    $filename = $basename . '.' . $extension;
    $filepath = $targetDir . DIRECTORY_SEPARATOR . $filename;
    $written = file_put_contents($filepath, $binary);
    if ($written === false) {
        respond_error(500, 'Failed to write capture image to disk.');
        return;
    }
    $metaPath = $targetDir . DIRECTORY_SEPARATOR . $basename . '.json';
    $meta = [
        'pageUrl' => $pageUrl,
        'pageTitle' => $title,
        'mode' => $mode,
        'dimensions' => $dimensions,
        'sourceDimensions' => $sourceDimensions,
        'mime' => $mime
    ];
    $metaSaved = write_metadata($metaPath, $meta);
    if (!$metaSaved) {
        respond_error(500, 'Failed to write capture metadata to disk.');
        return;
    }
    $sessionId = basename($sessionDir);
    $relative = '/static/screenshots/' . $sessionId;
    if ($slug !== '') {
        $relative .= '/' . $slug;
    }
    $relative .= '/' . $filename;
    $response = [
        'host' => $host,
        'mode' => $mode,
        'pageUrl' => $pageUrl,
        'pageTitle' => $title,
        'imageUrl' => $relative,
        'dimensions' => $dimensions,
        'sourceDimensions' => $sourceDimensions,
        'mime' => $mime
    ];
    respond_json(201, ['image' => $response]);
}

function capture_handle_status(): void
{
    $payload = capture_session_state();
    respond_json(200, $payload);
}

function capture_handle_stream(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    $level = ob_get_level();
    if ($level > 0) {
        ob_end_flush();
    }
    flush();
    $lastHash = '';
    while (true) {
        $status = connection_status();
        if ($status !== CONNECTION_NORMAL) {
            break;
        }
        $payload = capture_session_state();
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            echo "event: error\n";
            echo "data: {\"error\":\"Failed to encode stream payload.\"}\n\n";
            flush();
            break;
        }
        $hash = sha1($json);
        if ($hash !== $lastHash) {
            $lastHash = $hash;
            echo "event: update\n";
            echo 'data: ' . $json . "\n\n";
        } else {
            echo ": ping\n\n";
        }
        flush();
        sleep(10);
    }
}
