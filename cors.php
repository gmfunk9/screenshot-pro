<?php
// cors.php: self-hosted CORS inliner with local cache and media preservation
// This is just a reference file, the real file is on a different server.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: text/html; charset=utf-8');

const HUMAN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

$url = isset($_GET['url']) ? trim($_GET['url']) : '';
if ($url === '' || !preg_match('#^https?://#i', $url)) {
    http_response_code(400);
    exit('Usage: ?url=https://example.com');
}

$CACHE_DIR = __DIR__ . '/cache';
if (!is_dir($CACHE_DIR)) mkdir($CACHE_DIR, 0755, true);
$COOKIE_DIR = __DIR__ . '/cache/cookies';
if (!is_dir($COOKIE_DIR)) mkdir($COOKIE_DIR, 0755, true);

function cache_path($url) {
    global $CACHE_DIR;
    return $CACHE_DIR . '/' . sha1($url) . '.bin';
}

function cookie_path($url) {
    global $COOKIE_DIR;
    $parts = parse_url($url);
    if ($parts === false) return $COOKIE_DIR . '/anon.cookie';
    if (!isset($parts['host'])) return $COOKIE_DIR . '/anon.cookie';
    $host = trim($parts['host']);
    if ($host === '') return $COOKIE_DIR . '/anon.cookie';
    return $COOKIE_DIR . '/' . sha1($host) . '.cookie';
}

function url_origin($url) {
    $parts = parse_url($url);
    if ($parts === false) return '';
    if (!isset($parts['scheme'])) return '';
    if ($parts['scheme'] === '') return '';
    if (!isset($parts['host'])) return '';
    if ($parts['host'] === '') return '';
    $origin = $parts['scheme'] . '://' . $parts['host'];
    if (isset($parts['port'])) {
        if ($parts['port'] !== '') $origin .= ':' . $parts['port'];
    }
    return $origin;
}

function human_headers() {
    return [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9',
        'Cache-Control: no-cache',
        'Pragma: no-cache',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-User: ?1',
        'Upgrade-Insecure-Requests: 1',
    ];
}

function ensure_cookie_file($cookieFile) {
    if (file_exists($cookieFile)) return;
    file_put_contents($cookieFile, '');
}

function simulate_human_session($url, $cookieFile) {
    ensure_cookie_file($cookieFile);
    $origin = url_origin($url);
    if ($origin === '') return;
    $touchTargets = [$origin . '/'];
    $path = parse_url($url, PHP_URL_PATH);
    if ($path !== false) {
        if ($path !== '') $touchTargets[] = $origin . $path;
    }
    foreach ($touchTargets as $target) {
        $ch = curl_init($target);
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_USERAGENT => HUMAN_USER_AGENT,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => human_headers(),
            CURLOPT_COOKIEJAR => $cookieFile,
            CURLOPT_COOKIEFILE => $cookieFile,
            CURLOPT_REFERER => $origin,
        ];
        curl_setopt_array($ch, $options);
        curl_exec($ch);
        curl_close($ch);
        usleep(500000);
    }
    usleep(1500000);
}

function fetch_cached($url, $binary = false) {
    $cache = cache_path($url);
    if (file_exists($cache)) {
        $mimePath = $cache . '.mime';
        $mime = '';
        if (file_exists($mimePath)) $mime = trim((string)file_get_contents($mimePath));
        if ($mime === '') $mime = mime_content_type($cache) ?: '';
        return [file_get_contents($cache), $mime];
    }
    $cookieFile = cookie_path($url);
    simulate_human_session($url, $cookieFile);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_USERAGENT => HUMAN_USER_AGENT,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => human_headers(),
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
    ]);
    $referer = url_origin($url);
    if ($referer !== '') curl_setopt($ch, CURLOPT_REFERER, $referer);
    $data  = curl_exec($ch);
    $ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($data === false) return [null, null];
    if ($code >= 400) return [null, null];
    file_put_contents($cache, $data);
    if ($ctype !== false) file_put_contents($cache . '.mime', $ctype);
    return [$data, $ctype];
}

function resolve_url($base, $rel) {
    if ($rel === '' || preg_match('#^https?://$#i', $rel)) return null;
    if (preg_match('#^[a-z][a-z0-9+\-.]*://#i', $rel)) return $rel;
    if (strpos($rel, '//') === 0) {
        $scheme = parse_url($base, PHP_URL_SCHEME) ?: 'https';
        return $scheme . ':' . $rel;
    }
    $bp = parse_url($base);
    if (!$bp || empty($bp['scheme']) || empty($bp['host'])) return null;
    $dir = preg_replace('#/[^/]*$#', '/', $bp['path'] ?? '/');
    $path = ($rel[0] === '/') ? $rel : $dir . $rel;
    $segs = [];
    foreach (explode('/', $path) as $seg) {
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') { array_pop($segs); continue; }
        $segs[] = $seg;
    }
    return "{$bp['scheme']}://{$bp['host']}" . (isset($bp['port']) ? ":{$bp['port']}" : '') . '/' . implode('/', $segs);
}

function inline_css_assets($css, $base) {
    // Inline @import while preserving media lists
    $css = preg_replace_callback(
        '/@import\s+(?:url\()?["\']?([^"\')]+)["\']?\)?\s*([^;]*);/i',
        function ($m) use ($base) {
            $href = $m[1];
            $mediaList = trim($m[2] ?? '');
            $sub = resolve_url($base, $href);
            if (!$sub) return '';
            [$subCss] = fetch_cached($sub);
            if (!$subCss) return '';
            $inlined = inline_css_assets($subCss, $sub);
            if ($mediaList !== '') return "@media {$mediaList} {\n{$inlined}\n}";
            return $inlined;
        },
        $css
    );

    // Inline assets in url()
    $css = preg_replace_callback(
        '/url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)/i',
        function ($m) use ($base) {
            $src = trim($m[1]);
            if ($src === '' || preg_match('#^(data:|about:|blob:)#i', $src)) return $m[0];
            $u = resolve_url($base, $src);
            if (!$u) return $m[0];
            [$bin, $ctype] = fetch_cached($u, true);
            if (!$bin) return $m[0];
            $mime = $ctype ?: 'application/octet-stream';
            return 'url("data:' . $mime . ';base64,' . base64_encode($bin) . '")';
        },
        $css
    );

    return $css;
}

[$html] = fetch_cached($url);
if (!$html) exit('Fetch failed');

libxml_use_internal_errors(true);
$dom = new DOMDocument('1.0', 'UTF-8');
$dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_NONET);
$xpath = new DOMXPath($dom);

// remove strict CSP
foreach ($xpath->query("//meta[translate(@http-equiv,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='content-security-policy']") as $meta) {
    $meta->parentNode->removeChild($meta);
}

// inline stylesheets
foreach ($xpath->query("//link[contains(translate(@rel,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'stylesheet')]") as $link) {
    /** @var DOMElement $link */
    $href = trim($link->getAttribute('href'));
    if ($href === '') { $link->remove(); continue; }
    $abs = resolve_url($url, $href);
    if (!$abs) { $link->remove(); continue; }
    [$css] = fetch_cached($abs);
    if (!$css) { $link->remove(); continue; }
    $style = $dom->createElement('style', inline_css_assets($css, $abs));
    $media = trim($link->getAttribute('media'));
    if ($media !== '') $style->setAttribute('media', $media);
    $style->setAttribute('data-inlined', $abs);
    $link->parentNode->replaceChild($style, $link);
}

// inline <link rel=preload as=style>
foreach ($xpath->query("//link[contains(translate(@rel,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'preload')][translate(@as,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='style']") as $pre) {
    /** @var DOMElement $pre */
    $href = trim($pre->getAttribute('href'));
    if ($href === '') { $pre->parentNode->removeChild($pre); continue; }
    $abs = resolve_url($url, $href);
    if (!$abs) { $pre->parentNode->removeChild($pre); continue; }
    [$css] = fetch_cached($abs);
    if ($css) {
        $style = $dom->createElement('style', inline_css_assets($css, $abs));
        $media = trim($pre->getAttribute('media'));
        if ($media !== '') $style->setAttribute('media', $media);
        $style->setAttribute('data-inlined-preload', $abs);
        $pre->parentNode->replaceChild($style, $pre);
    } else {
        $pre->parentNode->removeChild($pre);
    }
}

// inline <img src>
foreach ($xpath->query("//img[@src]") as $img) {
    /** @var DOMElement $img */
    $src = trim($img->getAttribute('src'));
    if ($src === '' || preg_match('#^(data:|about:|blob:)#i', $src)) continue;
    $abs = resolve_url($url, $src);
    if (!$abs) continue;
    [$bin, $mime] = fetch_cached($abs, true);
    if (!$bin) continue;
    $img->setAttribute('src', 'data:' . ($mime ?: 'image/*') . ';base64,' . base64_encode($bin));
}

// remove scripts
foreach ($xpath->query("//script") as $s) $s->parentNode->removeChild($s);

echo $dom->saveHTML();
