<?php

declare(strict_types=1);

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/capture.php';

function offline_handle_export(): void
{
    $payload = capture_session_state();
    $images = [];
    if (isset($payload['images'])) {
        if (is_array($payload['images'])) {
            $images = $payload['images'];
        }
    }
    if (empty($images)) {
        respond_error(400, 'No screenshots captured; run a capture first.');
        return;
    }
    respond_json(200, $payload);
}
