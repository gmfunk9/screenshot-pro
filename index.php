<?php
declare(strict_types=1);

const START_SCRIPT = __DIR__ . '/start.sh';
const PID_FILE = __DIR__ . '/static/sspro-node.pid';
const PORT_FILE = __DIR__ . '/static/sspro-node.port';

function respond(string $body, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    echo $body;
}

function run_start(): array {
    if (!is_file(START_SCRIPT)) {
        return ['ok' => false, 'output' => 'start.sh not found.'];
    }
    if (!function_exists('shell_exec')) {
        return ['ok' => false, 'output' => 'shell_exec is disabled in PHP.'];
    }
    $output = trim((string)@shell_exec('bash ' . escapeshellarg(START_SCRIPT) . ' 2>&1'));
    return ['ok' => true, 'output' => $output];
}

function get_running_port(): string {
    if (is_file(PORT_FILE)) {
        $port = trim((string)file_get_contents(PORT_FILE));
        if ($port !== '') {
            return $port;
        }
    }
    return (string)(getenv('SSPRO_PORT') ?: '3216');
}

function is_server_running(): bool {
    if (!is_file(PID_FILE)) {
        return false;
    }
    $pid = trim((string)file_get_contents(PID_FILE));
    if ($pid === '') {
        return false;
    }
    if (function_exists('posix_kill')) {
        return @posix_kill((int)$pid, 0);
    }
    if (function_exists('shell_exec')) {
        $exit = trim((string)@shell_exec('kill -0 ' . escapeshellarg($pid) . ' 2>/dev/null; echo $?'));
        return $exit === '0';
    }
    return false;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
if ($path === '/start') {
    $result = run_start();
    $escaped = htmlspecialchars($result['output'], ENT_QUOTES);
    respond("<pre>{$escaped}</pre>", $result['ok'] ? 200 : 500);
    exit;
}

$isRunning = is_server_running();
$port = get_running_port();
$status = $isRunning ? 'Running' : 'Not running';
$link = 'http://localhost:' . $port . '/';
$startUrl = '/start';
$html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screenshot Pro Launcher</title>
    <style>
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; color: #0f172a; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; }
        code { display: block; white-space: pre-wrap; }
        a { color: #2563eb; font-weight: 600; }
    </style>
</head>
<body>
    <h1>Screenshot Pro</h1>
    <p>Status: <strong>{$status}</strong></p>
    <p><a href="$link">Open the app</a></p>
    <p><a href="{$startUrl}">Start server</a></p>
    <div class="box">
        <strong>Port</strong>
        <code>{$port}</code>
    </div>
</body>
</html>
HTML;

respond($html, 200);
