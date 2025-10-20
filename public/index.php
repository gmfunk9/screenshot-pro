<?php

declare(strict_types=1);

require_once __DIR__ . '/../php/util.php';
require_once __DIR__ . '/../php/session.php';
require_once __DIR__ . '/../php/capture.php';
require_once __DIR__ . '/../php/pdf.php';
require_once __DIR__ . '/../php/offline.php';

function request_path(): string
{
    $uri = '/';
    if (isset($_SERVER['REQUEST_URI'])) {
        $uri = (string) $_SERVER['REQUEST_URI'];
    }
    $parsed = parse_url($uri, PHP_URL_PATH);
    if (!is_string($parsed)) {
        return '/';
    }
    if ($parsed === '') {
        return '/';
    }
    return $parsed;
}

function request_method(): string
{
    $method = 'GET';
    if (isset($_SERVER['REQUEST_METHOD'])) {
        $method = (string) $_SERVER['REQUEST_METHOD'];
    }
    return strtoupper($method);
}

function static_root(): string
{
    $resolved = realpath(__DIR__ . '/../static');
    if ($resolved !== false) {
        return $resolved;
    }
    return __DIR__ . '/../static';
}

function serve_file(string $path): void
{
    if (!file_exists($path)) {
        http_response_code(404);
        echo 'Not found.';
        return;
    }
    if (is_dir($path)) {
        http_response_code(403);
        echo 'Directory listing disabled.';
        return;
    }
    $type = mime_content_type($path);
    if ($type === false) {
        $type = 'application/octet-stream';
    }
    header('Content-Type: ' . $type);
    readfile($path);
}

function serve_static(string $path): void
{
    $root = static_root();
    $relative = substr($path, strlen('/static/'));
    $candidate = $root . DIRECTORY_SEPARATOR . $relative;
    $real = realpath($candidate);
    if ($real === false) {
        http_response_code(404);
        echo 'Static asset not found.';
        return;
    }
    $normalizedRoot = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (strpos($real, $normalizedRoot) !== 0) {
        http_response_code(403);
        echo 'Access denied.';
        return;
    }
    serve_file($real);
}

function handle_session(): void
{
    $method = request_method();
    if ($method === 'GET') {
        respond_json(200, ['session' => session_summary()]);
        return;
    }
    if ($method === 'POST') {
        $summary = new_session();
        respond_json(201, ['session' => $summary]);
        return;
    }
    if ($method === 'DELETE') {
        $host = '';
        if (isset($_GET['host'])) {
            $host = trim((string) $_GET['host']);
        }
        if ($host === '') {
            clear_session();
            respond_json(200, ['status' => 'session cleared']);
            return;
        }
        clear_site($host);
        respond_json(200, ['status' => 'host cleared', 'host' => $host]);
        return;
    }
    http_response_code(405);
    echo 'Method not allowed.';
}

$path = request_path();

if ($path === '/' || $path === '') {
    serve_file(static_root() . '/index.html');
    return;
}

if ($path === '/favicon.ico') {
    http_response_code(404);
    echo 'Not found.';
    return;
}

if (strpos($path, '/static/') === 0) {
    serve_static($path);
    return;
}

if ($path === '/session') {
    handle_session();
    return;
}

if ($path === '/capture/sitemap') {
    capture_handle_sitemap();
    return;
}

if ($path === '/capture/store') {
    if (request_method() !== 'POST') {
        http_response_code(405);
        echo 'Method not allowed.';
        return;
    }
    capture_handle_store();
    return;
}

if ($path === '/capture/status') {
    capture_handle_status();
    return;
}

if ($path === '/proxy') {
    capture_handle_proxy();
    return;
}

if ($path === '/export/pdf') {
    pdf_handle_export();
    return;
}

if ($path === '/export/offline') {
    offline_handle_export();
    return;
}

http_response_code(404);
respond_error(404, 'Route not found.');
