<?php

declare(strict_types=1);

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false) {
        return [];
    }
    if ($raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }
    return $decoded;
}

function respond_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
}

function respond_error(int $status, string $message): void
{
    respond_json($status, ['error' => $message]);
}

function ensure_directory(string $path): void
{
    if ($path === '') {
        return;
    }
    if (is_dir($path)) {
        return;
    }
    mkdir($path, 0775, true);
}

function delete_path(string $path): void
{
    if ($path === '') {
        return;
    }
    if (!file_exists($path)) {
        return;
    }
    if (is_file($path)) {
        unlink($path);
        return;
    }
    $items = scandir($path);
    if ($items === false) {
        return;
    }
    foreach ($items as $item) {
        if ($item === '.') {
            continue;
        }
        if ($item === '..') {
            continue;
        }
        $child = $path . DIRECTORY_SEPARATOR . $item;
        delete_path($child);
    }
    rmdir($path);
}
