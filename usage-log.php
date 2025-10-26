<?php
header('Content-Type: application/json');
function respond_error($status, $message) {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'POST') {
    respond_error(405, 'Unsupported method; send POST.');
}
$raw = file_get_contents('php://input');
if ($raw === false) {
    respond_error(500, 'Failed to read request body.');
}
if ($raw === '') {
    respond_error(400, 'Missing body; provide JSON payload.');
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond_error(400, 'Invalid JSON payload; provide object.');
}
if (!array_key_exists('event', $data)) {
    respond_error(400, 'Missing field event; add to body.');
}
$event = (string)$data['event'];
$event = trim($event);
if ($event === '') {
    respond_error(400, 'Missing field event; add to body.');
}
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
    $created = mkdir($logDir, 0755, true);
    if (!$created) {
        respond_error(500, 'Failed to create logs directory.');
    }
}
$entry = [
    'timestamp' => gmdate('c'),
    'event' => $event,
    'action' => $data['action'] ?? null,
    'timer' => $data['timer'] ?? null,
    'elapsedMs' => $data['elapsedMs'] ?? null,
    'payload' => $data['payload'] ?? null,
    'state' => $data['state'] ?? null
];
$encoded = json_encode($entry);
if ($encoded === false) {
    respond_error(500, 'Failed to encode log entry.');
}
$written = file_put_contents($logDir . '/usage.log', $encoded . PHP_EOL, FILE_APPEND | LOCK_EX);
if ($written === false) {
    respond_error(500, 'Failed to write usage log.');
}
echo json_encode(['status' => 'ok']);
