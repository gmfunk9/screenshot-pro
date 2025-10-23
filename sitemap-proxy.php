<?php
const TARGET_ENDPOINT = 'https://getsitemap.funkpd.com/json';
const PAGE_LIMIT = 10;
const MAX_RETRIES = 3;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$urlParam = $_GET['url'] ?? '';
$trimmedUrl = trim($urlParam);

if ($trimmedUrl === '') {
    respond(['error' => 'Missing or empty url parameter.'], 400);
}

$startsWithHttp = str_starts_with($trimmedUrl, 'http://');
$startsWithHttps = str_starts_with($trimmedUrl, 'https://');

if ($startsWithHttp === false && $startsWithHttps === false) {
    respond(['error' => 'Invalid URL scheme. Use http or https.'], 400);
}

$queryUrl = TARGET_ENDPOINT . '?url=' . rawurlencode($trimmedUrl);

$context = stream_context_create([
    'http' => [
        'timeout' => 10,
        'ignore_errors' => true,
        'header' => "User-Agent: ScreenshotProProxy/1.0\r\n"
    ]
]);

$response = false;
$delaySeconds = 0.5;

for ($attempt = 1; $attempt <= MAX_RETRIES; $attempt++) {
    $response = @file_get_contents($queryUrl, false, $context);

    if ($response !== false) {
        break;
    }

    if ($attempt < MAX_RETRIES) {
        usleep((int)($delaySeconds * 1000000));
        $delaySeconds = $delaySeconds * 2;
    }
}

if ($response === false) {
    respond(['error' => 'Failed to fetch sitemap after retries.'], 502);
}

$json = json_decode($response, true);

if (!is_array($json)) {
    respond(['error' => 'Invalid JSON from upstream.'], 502);
}

if (!array_key_exists('sitemap', $json)) {
    respond(['error' => 'Missing sitemap key.'], 502);
}

if (!is_array($json['sitemap'])) {
    respond(['error' => 'Sitemap is not an array.'], 502);
}

$entries = [];
foreach ($json['sitemap'] as $entry) {
    if (!is_string($entry)) {
        continue;
    }

    $entries[] = $entry;

    if (count($entries) >= PAGE_LIMIT) {
        break;
    }
}

respond([
    'sitemap' => $entries,
    'limit' => PAGE_LIMIT,
    'sourceCount' => count($json['sitemap'])
]);
