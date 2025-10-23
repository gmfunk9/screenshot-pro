<?php
declare(strict_types=1);

const TARGET_ENDPOINT = 'https://getsitemap.funkpd.com/json';
const PAGE_LIMIT = 5;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function respond(array $body, int $status = 200): void {
    http_response_code($status);
    $json = json_encode($body);
    if ($json === false) {
        http_response_code(500);
        echo '{"error":"Failed to encode response."}';
        exit;
    }
    echo $json;
    exit;
}

$hasUrlParam = array_key_exists('url', $_GET);
if ($hasUrlParam === false) {
    respond(['error' => 'Missing query parameter url.'], 400);
}

$rawUrl = (string) $_GET['url'];
$trimmedUrl = trim($rawUrl);
if ($trimmedUrl === '') {
    respond(['error' => 'Empty url parameter.'], 400);
}

$startsWithHttp = strncasecmp($trimmedUrl, 'http://', 7) === 0;
if ($startsWithHttp === false) {
    $startsWithHttps = strncasecmp($trimmedUrl, 'https://', 8) === 0;
    if ($startsWithHttps === false) {
        respond(['error' => 'Invalid url scheme; use http or https.'], 400);
    }
}

$query = TARGET_ENDPOINT . '?url=' . rawurlencode($trimmedUrl);
$contextOptions = [
    'http' => [
        'method' => 'GET',
        'timeout' => 10,
        'ignore_errors' => true,
        'header' => "User-Agent: ScreenshotProProxy/1.0\r\n",
    ],
];
$context = stream_context_create($contextOptions);
$response = @file_get_contents($query, false, $context);
if ($response === false) {
    respond(['error' => 'Failed to fetch sitemap upstream.'], 502);
}

$statusLine = '';
if (isset($http_response_header[0])) {
    $statusLine = $http_response_header[0];
}
if ($statusLine === '') {
    respond(['error' => 'Upstream response missing status line.'], 502);
}

$statusParts = explode(' ', $statusLine);
$httpStatus = 0;
if (count($statusParts) > 1) {
    $httpStatus = (int) $statusParts[1];
}
if ($httpStatus >= 400) {
    respond(['error' => 'Upstream sitemap request failed.', 'status' => $httpStatus], 502);
}

$data = json_decode($response, true);
if (!is_array($data)) {
    respond(['error' => 'Invalid sitemap payload; expected JSON object.'], 502);
}

if (!array_key_exists('sitemap', $data)) {
    respond(['error' => 'Sitemap key missing in payload.'], 502);
}

if (!is_array($data['sitemap'])) {
    respond(['error' => 'Sitemap entry is not an array.'], 502);
}

$entries = [];
foreach ($data['sitemap'] as $entry) {
    if (!is_string($entry)) {
        continue;
    }
    $entries[] = $entry;
    if (count($entries) === PAGE_LIMIT) {
        break;
    }
}

respond([
    'sitemap' => $entries,
    'limit' => PAGE_LIMIT,
    'sourceCount' => count($data['sitemap']),
]);
