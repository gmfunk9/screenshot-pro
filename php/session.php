<?php

declare(strict_types=1);

require_once __DIR__ . '/util.php';

const STORAGE_ROOT = __DIR__ . '/../static/screenshots';
const DATA_ROOT = __DIR__ . '/../var';
const CURRENT_SESSION_FILE = DATA_ROOT . '/current-session.txt';

function session_data_dir(): string
{
    ensure_directory(DATA_ROOT);
    return DATA_ROOT;
}

function session_storage_root(): string
{
    ensure_directory(STORAGE_ROOT);
    return STORAGE_ROOT;
}

function read_current_session_id(): string
{
    session_data_dir();
    if (!file_exists(CURRENT_SESSION_FILE)) {
        return '';
    }
    $raw = file_get_contents(CURRENT_SESSION_FILE);
    if ($raw === false) {
        return '';
    }
    return trim($raw);
}

function write_current_session_id(string $id): void
{
    session_data_dir();
    file_put_contents(CURRENT_SESSION_FILE, $id);
}

function sanitize_host(string $host): string
{
    if ($host === '') {
        return '';
    }
    return str_replace('.', '_', $host);
}

function unslug_host(string $slug): string
{
    return str_replace('_', '.', $slug);
}

function new_session_id(): string
{
    $micro = microtime(true);
    $formatted = sprintf('%.0f', $micro * 1000);
    return $formatted;
}

function build_session_path(string $id): string
{
    $root = session_storage_root();
    return $root . DIRECTORY_SEPARATOR . $id;
}

function session_path(): string
{
    $currentId = read_current_session_id();
    if ($currentId !== '') {
        $existing = build_session_path($currentId);
        if (is_dir($existing)) {
            return $existing;
        }
    }
    $freshId = new_session_id();
    $freshPath = build_session_path($freshId);
    ensure_directory($freshPath);
    write_current_session_id($freshId);
    return $freshPath;
}

function new_session(): array
{
    $freshId = new_session_id();
    $freshPath = build_session_path($freshId);
    ensure_directory($freshPath);
    write_current_session_id($freshId);
    return session_summary();
}

function clear_session(): void
{
    $path = session_path();
    delete_path($path);
    write_current_session_id('');
}

function host_path(string $host): string
{
    $base = session_path();
    $slug = sanitize_host($host);
    if ($slug === '') {
        return $base;
    }
    return $base . DIRECTORY_SEPARATOR . $slug;
}

function clear_site(string $host): void
{
    $slug = sanitize_host($host);
    if ($slug === '') {
        clear_session();
        return;
    }
    $base = session_path();
    $dir = $base . DIRECTORY_SEPARATOR . $slug;
    delete_path($dir);
}

function list_images(): array
{
    $base = session_path();
    if (!is_dir($base)) {
        return [];
    }
    $hosts = scandir($base);
    if ($hosts === false) {
        return [];
    }
    $files = [];
    foreach ($hosts as $entry) {
        if ($entry === '.') {
            continue;
        }
        if ($entry === '..') {
            continue;
        }
        $dir = $base . DIRECTORY_SEPARATOR . $entry;
        if (!is_dir($dir)) {
            continue;
        }
        $images = scandir($dir);
        if ($images === false) {
            continue;
        }
        foreach ($images as $name) {
            if ($name === '.') {
                continue;
            }
            if ($name === '..') {
                continue;
            }
            if (!str_ends_with($name, '.png')) {
                continue;
            }
            $filepath = $dir . DIRECTORY_SEPARATOR . $name;
            $meta = [];
            $info = pathinfo($name);
            if (isset($info['filename'])) {
                $metaPath = $dir . DIRECTORY_SEPARATOR . $info['filename'] . '.json';
                if (file_exists($metaPath)) {
                    $rawMeta = file_get_contents($metaPath);
                    if ($rawMeta !== false) {
                        if ($rawMeta !== '') {
                            $decoded = json_decode($rawMeta, true);
                            if (is_array($decoded)) {
                                $meta = $decoded;
                            }
                        }
                    }
                }
            }
            $files[] = [
                'host' => unslug_host($entry),
                'filepath' => $filepath,
                'filename' => $name,
                'meta' => $meta
            ];
        }
    }
    return $files;
}

function session_summary(): array
{
    $base = session_path();
    $id = basename($base);
    $hosts = [];
    if (is_dir($base)) {
        $entries = scandir($base);
        if ($entries !== false) {
            foreach ($entries as $entry) {
                if ($entry === '.') {
                    continue;
                }
                if ($entry === '..') {
                    continue;
                }
                $dir = $base . DIRECTORY_SEPARATOR . $entry;
                if (!is_dir($dir)) {
                    continue;
                }
                $hosts[] = unslug_host($entry);
            }
        }
    }
    return [
        'id' => $id,
        'path' => $base,
        'hosts' => $hosts
    ];
}
