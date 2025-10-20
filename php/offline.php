<?php

declare(strict_types=1);

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/session.php';

function safe_text(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function load_style_sheet(): string
{
    $path = __DIR__ . '/../static/css/style.min.css';
    if (!file_exists($path)) {
        return '';
    }
    $css = file_get_contents($path);
    if ($css === false) {
        return '';
    }
    return $css;
}

function build_image_card(array $entry): string
{
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
    $host = '';
    if (isset($entry['host'])) {
        if (is_string($entry['host'])) {
            $host = $entry['host'];
        }
    }
    $path = '';
    if (isset($entry['filepath'])) {
        if (is_string($entry['filepath'])) {
            $path = $entry['filepath'];
        }
    }
    if ($path === '') {
        return '';
    }
    if (!file_exists($path)) {
        return '';
    }
    $binary = file_get_contents($path);
    if ($binary === false) {
        return '';
    }
    $encoded = base64_encode($binary);
    $dataUrl = 'data:image/png;base64,' . $encoded;
    $modeLabel = ucfirst(strtolower($mode));
    $card = "<article class=\"card\">\n";
    $card .= "  <header class=\"card__meta\">\n";
    if ($host !== '') {
        $card .= '    <p class="card__title">' . safe_text($host) . "</p>\n";
    }
    $card .= '    <span class="card__badge">' . safe_text($modeLabel) . "</span>\n";
    $card .= "  </header>\n";
    $card .= '  <img class="card__media" src="' . $dataUrl . '" alt="' . safe_text($pageTitle) . '" />' . "\n";
    $card .= "  <div class=\"card__actions\">\n";
    if ($pageUrl !== '') {
        $card .= '    <a href="' . safe_text($pageUrl) . '" target="_blank" rel="noopener">View page</a>' . "\n";
    }
    $card .= '    <a href="' . $dataUrl . '" download>Download image</a>' . "\n";
    $card .= "  </div>\n";
    $card .= "</article>\n";
    return $card;
}

function offline_handle_export(): void
{
    $images = list_images();
    if (empty($images)) {
        respond_error(400, 'No screenshots captured; run a capture first.');
        return;
    }
    $cards = '';
    foreach ($images as $entry) {
        $card = build_image_card($entry);
        if ($card === '') {
            continue;
        }
        $cards .= $card;
    }
    if ($cards === '') {
        respond_error(500, 'Failed to inline screenshots for offline bundle.');
        return;
    }
    $summary = session_summary();
    $style = load_style_sheet();
    $html = "<!DOCTYPE html>\n";
    $html .= "<html lang=\"en\">\n";
    $html .= "<head>\n";
    $html .= "  <meta charset=\"UTF-8\">\n";
    $html .= "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
    $html .= "  <title>Screenshot Pro Offline Bundle</title>\n";
    if ($style !== '') {
        $html .= "  <style>" . $style . "</style>\n";
    }
    $html .= "</head>\n";
    $html .= "<body>\n";
    $html .= "  <main class=\"stack stack--lg\" style=\"padding:24px;max-width:1200px;margin:0 auto;\">\n";
    $html .= "    <header class=\"stack stack--sm\">\n";
    $html .= "      <h1>Screenshot Pro Offline Bundle</h1>\n";
    $sessionId = '';
    if (isset($summary['id'])) {
        $sessionId = (string) $summary['id'];
    }
    $html .= '      <p>Session ' . safe_text($sessionId) . "</p>\n";
    $html .= "    </header>\n";
    $html .= "    <section class=\"gallery__grid\">\n";
    $html .= $cards;
    $html .= "    </section>\n";
    $html .= "  </main>\n";
    $html .= "</body>\n";
    $html .= "</html>";
    header('Content-Type: text/html; charset=UTF-8');
    header('Content-Disposition: attachment; filename="screenshot-pro.html"');
    header('Content-Length: ' . strlen($html));
    echo $html;
}
