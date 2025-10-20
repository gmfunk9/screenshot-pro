<?php

declare(strict_types=1);

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/session.php';

const SITEMAP_ENDPOINT = 'https://getsitemap.funkpd.com/json';

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

function decode_image_payload(string $data): string
{
    $prefix = 'base64,';
    $pos = strpos($data, $prefix);
    if ($pos === false) {
        return '';
    }
    $encoded = substr($data, $pos + strlen($prefix));
    if ($encoded === false) {
        return '';
    }
    $decoded = base64_decode($encoded, true);
    if ($decoded === false) {
        return '';
    }
    return $decoded;
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
    $body = read_json_body();
    $imageData = '';
    if (isset($body['imageData'])) {
        $imageData = (string) $body['imageData'];
    }
    if ($imageData === '') {
        respond_error(400, 'Missing field imageData; add to body.');
        return;
    }
    $pageUrl = '';
    if (isset($body['pageUrl'])) {
        $pageUrl = trim((string) $body['pageUrl']);
    }
    if ($pageUrl === '') {
        respond_error(400, 'Missing field pageUrl; add to body.');
        return;
    }
    $host = '';
    if (isset($body['host'])) {
        $host = trim((string) $body['host']);
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
    if (isset($body['mode'])) {
        $candidate = trim((string) $body['mode']);
        if ($candidate !== '') {
            $mode = $candidate;
        }
    }
    $title = 'Captured page';
    if (isset($body['pageTitle'])) {
        $candidate = trim((string) $body['pageTitle']);
        if ($candidate !== '') {
            $title = $candidate;
        }
    }
    $dimensions = ['width' => 0, 'height' => 0];
    if (isset($body['dimensions'])) {
        $dims = $body['dimensions'];
        if (is_array($dims)) {
            if (isset($dims['width'])) {
                $width = (int) $dims['width'];
                $dimensions['width'] = $width;
            }
            if (isset($dims['height'])) {
                $height = (int) $dims['height'];
                $dimensions['height'] = $height;
            }
        }
    }
    $binary = decode_image_payload($imageData);
    if ($binary === '') {
        respond_error(400, 'Invalid imageData payload; expected base64 PNG.');
        return;
    }
    $sessionDir = session_path();
    $slug = sanitize_host($host);
    $targetDir = $sessionDir;
    if ($slug !== '') {
        $targetDir = $sessionDir . DIRECTORY_SEPARATOR . $slug;
    }
    ensure_directory($targetDir);
    $basename = new_session_id();
    $filename = $basename . '.png';
    $filepath = $targetDir . DIRECTORY_SEPARATOR . $filename;
    $written = file_put_contents($filepath, $binary);
    if ($written === false) {
        respond_error(500, 'Failed to write capture PNG to disk.');
        return;
    }
    $metaPath = $targetDir . DIRECTORY_SEPARATOR . $basename . '.json';
    $meta = [
        'pageUrl' => $pageUrl,
        'pageTitle' => $title,
        'mode' => $mode,
        'dimensions' => $dimensions
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
        'dimensions' => $dimensions
    ];
    respond_json(201, ['image' => $response]);
}

function capture_handle_status(): void
{
    $sessionDir = session_path();
    $sessionId = basename($sessionDir);
    $images = list_images();
    $result = [];
    foreach ($images as $entry) {
        $slug = sanitize_host($entry['host']);
        $relative = '/static/screenshots/' . $sessionId;
        if ($slug !== '') {
            $relative .= '/' . $slug;
        }
        $relative .= '/' . $entry['filename'];
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
        $result[] = [
            'host' => $entry['host'],
            'imageUrl' => $relative,
            'pageUrl' => $pageUrl,
            'pageTitle' => $pageTitle,
            'mode' => $mode,
            'dimensions' => $dimensions
        ];
    }
    respond_json(200, [
        'session' => session_summary(),
        'images' => $result
    ]);
}
