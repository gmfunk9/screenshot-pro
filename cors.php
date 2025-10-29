<?php
// cors.php — aggressive inliner version
// fetches a remote page, inlines all assets (CSS, images, backgrounds) as base64
// removes JS entirely to prevent "wait for human" gates
// outputs fully self-contained HTML safe for html2canvas rendering

header('Access-Control-Allow-Origin: *');
header('Content-Type: text/html; charset=utf-8');
set_time_limit(60);
error_reporting(E_ERROR | E_PARSE);

$url = isset($_GET['url']) ? trim($_GET['url']) : '';
if ($url === '') {
    http_response_code(400);
    echo 'Missing ?url=';
    exit;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolve_url(string $base, string $relative): string {
    if (preg_match('#^https?://#i', $relative)) return $relative;
    if (strpos($relative, '//') === 0) {
        $scheme = parse_url($base, PHP_URL_SCHEME) ?: 'https';
        return $scheme . ':' . $relative;
    }
    $baseParts = parse_url($base);
    if (!isset($baseParts['scheme'], $baseParts['host'])) return $relative;
    $scheme = $baseParts['scheme'];
    $host = $baseParts['host'];
    $path = $baseParts['path'] ?? '/';
    $path = preg_replace('#/[^/]*$#', '/', $path);
    if (strpos($relative, '/') === 0) $path = '';
    $abs = "$scheme://$host$path$relative";
    $abs = preg_replace('#(?<!:)/+#', '/', $abs);
    return $abs;
}

function fetch_remote_binary(string $u): ?array {
    $opts = [
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'header' => "User-Agent: ScreenshotPro/1.0\r\nAccept: */*\r\n"
        ]
    ];
    $ctx = stream_context_create($opts);
    $data = @file_get_contents($u, false, $ctx);
    if ($data === false) return null;
    $meta = $http_response_header ?? [];
    $mime = 'application/octet-stream';
    foreach ($meta as $h) {
        if (stripos($h, 'Content-Type:') === 0) {
            $mime = trim(substr($h, 13));
            break;
        }
    }
    return [$data, $mime];
}

function fetch_remote_html(string $u): ?string {
    $opts = [
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
            'header' => "User-Agent: ScreenshotPro/1.0\r\nAccept: text/html\r\n"
        ]
    ];
    $ctx = stream_context_create($opts);
    $data = @file_get_contents($u, false, $ctx);
    if ($data === false) return null;
    return $data;
}

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

$html = fetch_remote_html($url);
if (!$html) {
    http_response_code(500);
    echo "Failed to fetch remote HTML.";
    exit;
}

libxml_use_internal_errors(true);
$dom = new DOMDocument();
@$dom->loadHTML($html);
$xpath = new DOMXPath($dom);

// ---------------------------------------------------------------------------
// Remove scripts completely (they block rendering or require human interaction)
// ---------------------------------------------------------------------------
foreach ($xpath->query('//script') as $s) {
    $s->parentNode->removeChild($s);
}

// ---------------------------------------------------------------------------
// Inline stylesheets (<link rel=stylesheet> → <style>)
// ---------------------------------------------------------------------------
foreach ($xpath->query('//link[@rel="stylesheet"]') as $link) {
    $href = trim($link->getAttribute('href'));
    if ($href === '') continue;
    $abs = resolve_url($url, $href);
    [$css, $mime] = fetch_remote_binary($abs) ?? [null, null];
    if ($css) {
        $style = $dom->createElement('style', $css);
        $link->parentNode->replaceChild($style, $link);
    }
}

// ---------------------------------------------------------------------------
// Inline images (<img>, <source>, srcset, data-lazy, etc.)
// ---------------------------------------------------------------------------
foreach ($xpath->query('//img|//source') as $el) {
    /** @var DOMElement $el */
    $attrs = ['src', 'data-src', 'data-lazy', 'data-original', 'data-srcset', 'srcset'];
    foreach ($attrs as $attr) {
        $val = trim($el->getAttribute($attr));
        if ($val === '' || preg_match('#^(data:|about:|blob:)#i', $val)) continue;
        $abs = resolve_url($url, $val);
        if (!$abs) continue;
        [$bin, $mime] = fetch_remote_binary($abs) ?? [null, null];
        if (!$bin) continue;
        $encoded = 'data:' . ($mime ?: 'image/webp') . ';base64,' . base64_encode($bin);
        if (strpos($attr, 'set') !== false) {
            $el->setAttribute('srcset', $encoded);
        } else {
            $el->setAttribute('src', $encoded);
        }
    }
}

// ---------------------------------------------------------------------------
// Inline CSS background-image URLs inside <style> tags
// ---------------------------------------------------------------------------
foreach ($xpath->query('//style') as $styleEl) {
    $css = $styleEl->textContent;
    $css = preg_replace_callback(
        '/url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)/i',
        function ($m) use ($url) {
            $src = trim($m[1]);
            if ($src === '' || preg_match('#^(data:|about:|blob:)#i', $src)) return $m[0];
            $abs = resolve_url($url, $src);
            if (!$abs) return $m[0];
            [$bin, $mime] = fetch_remote_binary($abs) ?? [null, null];
            if (!$bin) return $m[0];
            $encoded = 'data:' . ($mime ?: 'image/webp') . ';base64,' . base64_encode($bin);
            return 'url("' . $encoded . '")';
        },
        $css
    );
    $styleEl->nodeValue = $css;
}

// ---------------------------------------------------------------------------
// Ensure body visible and mark ready for capture
// ---------------------------------------------------------------------------
$style = $dom->createElement('style', 'body{visibility:visible!important;opacity:1!important;}');
$dom->documentElement->appendChild($style);

$script = $dom->createElement('script', 'window.__FUNKPD_CAPTURE_READY=true;');
$dom->documentElement->appendChild($script);

// ---------------------------------------------------------------------------
// Output final HTML
// ---------------------------------------------------------------------------
echo $dom->saveHTML();