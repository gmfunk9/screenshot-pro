<?php

declare(strict_types=1);

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/session.php';

const PDF_PAGE_WIDTH = 595.0;
const PDF_PAGE_HEIGHT = 842.0;

function build_pdf_with_imagick(array $paths): string
{
    try {
        $doc = new \Imagick();
    } catch (\Throwable $error) {
        return '';
    }
    foreach ($paths as $path) {
        try {
            $page = new \Imagick();
            $page->readImage($path);
        } catch (\Throwable $error) {
            continue;
        }
        try {
            $page->setImageAlphaChannel(\Imagick::ALPHACHANNEL_REMOVE);
        } catch (\Throwable $error) {
            // continue even if alpha removal fails
        }
        try {
            $page->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
        } catch (\Throwable $error) {
            // ignore flatten errors
        }
        $page->setImageFormat('png');
        $doc->addImage($page);
    }
    if ($doc->getNumberImages() === 0) {
        return '';
    }
    $doc->setImageFormat('pdf');
    $blob = $doc->getImagesBlob();
    if (!is_string($blob)) {
        return '';
    }
    return $blob;
}

function gd_image_to_jpeg(string $path): array
{
    $result = ['data' => '', 'width' => 0, 'height' => 0];
    if (!file_exists($path)) {
        return $result;
    }
    $resource = imagecreatefrompng($path);
    if ($resource === false) {
        return $result;
    }
    $width = imagesx($resource);
    $height = imagesy($resource);
    ob_start();
    imagejpeg($resource, null, 90);
    $jpeg = ob_get_contents();
    ob_end_clean();
    imagedestroy($resource);
    if (!is_string($jpeg)) {
        return $result;
    }
    $result['data'] = $jpeg;
    $result['width'] = (float) $width;
    $result['height'] = (float) $height;
    return $result;
}

function format_number(float $value): string
{
    return rtrim(rtrim(sprintf('%.2f', $value), '0'), '.');
}

function build_pdf_from_frames(array $frames): string
{
    $objects = [];
    $pageObjects = [];
    $nextId = 1;
    $index = 0;
    foreach ($frames as $frame) {
        $imageId = $nextId;
        $nextId += 1;
        $contentId = $nextId;
        $nextId += 1;
        $pageId = $nextId;
        $nextId += 1;
        $imageName = 'Im' . ($index + 1);
        $width = $frame['width'];
        $height = $frame['height'];
        if ($width <= 0) {
            $width = 1;
        }
        if ($height <= 0) {
            $height = 1;
        }
        $scaleWidth = PDF_PAGE_WIDTH / $width;
        $scaleHeight = PDF_PAGE_HEIGHT / $height;
        $scale = $scaleWidth;
        if ($scaleHeight < $scale) {
            $scale = $scaleHeight;
        }
        $scaledWidth = $width * $scale;
        $scaledHeight = $height * $scale;
        $offsetX = (PDF_PAGE_WIDTH - $scaledWidth) / 2.0;
        $offsetY = (PDF_PAGE_HEIGHT - $scaledHeight) / 2.0;
        $imageStream = '<< /Type /XObject /Subtype /Image /Width ' . format_number($width)
            . ' /Height ' . format_number($height)
            . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($frame['data']) . " >>\n";
        $imageStream .= "stream\n";
        $imageStream .= $frame['data'];
        $imageStream .= "\nendstream";
        $objects[] = [
            'id' => $imageId,
            'content' => $imageStream
        ];
        $contentData = "q\n";
        $contentData .= format_number($scaledWidth) . ' 0 0 ' . format_number($scaledHeight) . ' ' . format_number($offsetX) . ' ' . format_number($offsetY) . " cm\n";
        $contentData .= '/' . $imageName . " Do\n";
        $contentData .= "Q\n";
        $contentStream = '<< /Length ' . strlen($contentData) . " >>\n";
        $contentStream .= "stream\n" . $contentData . "endstream";
        $objects[] = [
            'id' => $contentId,
            'content' => $contentStream
        ];
        $pageTemplate = '<< /Type /Page /Parent __PARENT__ /MediaBox [0 0 ' . format_number(PDF_PAGE_WIDTH)
            . ' ' . format_number(PDF_PAGE_HEIGHT) . '] /Resources << /XObject << /' . $imageName . ' '
            . $imageId . ' 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ' . $contentId . " 0 R >>";
        $pageObjects[] = [
            'id' => $pageId,
            'content' => $pageTemplate
        ];
        $index += 1;
    }
    if (empty($pageObjects)) {
        return '';
    }
    $pagesId = $nextId;
    $nextId += 1;
    $catalogId = $nextId;
    $nextId += 1;
    $kids = [];
    foreach ($pageObjects as $page) {
        $kids[] = $page['id'] . ' 0 R';
    }
    $pagesContent = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . count($pageObjects) . ' >>';
    $objects[] = [
        'id' => $pagesId,
        'content' => $pagesContent
    ];
    $catalogContent = '<< /Type /Catalog /Pages ' . $pagesId . ' 0 R >>';
    $objects[] = [
        'id' => $catalogId,
        'content' => $catalogContent
    ];
    foreach ($pageObjects as $page) {
        $content = str_replace('__PARENT__', $pagesId . ' 0 R', $page['content']);
        $objects[] = [
            'id' => $page['id'],
            'content' => $content
        ];
    }
    usort($objects, function (array $left, array $right): int {
        if ($left['id'] === $right['id']) {
            return 0;
        }
        if ($left['id'] < $right['id']) {
            return -1;
        }
        return 1;
    });
    $body = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objects as $object) {
        $offsets[$object['id']] = strlen($body);
        $body .= $object['id'] . " 0 obj\n";
        $body .= $object['content'] . "\nendobj\n";
    }
    $xrefPosition = strlen($body);
    $lastId = max(array_keys($offsets));
    $body .= 'xref\n0 ' . ($lastId + 1) . "\n";
    $body .= "0000000000 65535 f \n";
    for ($i = 1; $i <= $lastId; $i += 1) {
        $offset = 0;
        if (isset($offsets[$i])) {
            $offset = $offsets[$i];
        }
        $body .= sprintf('%010d 00000 n ', $offset) . "\n";
    }
    $body .= 'trailer\n<< /Size ' . ($lastId + 1) . ' /Root ' . $catalogId . " 0 R >>\n";
    $body .= 'startxref\n' . $xrefPosition . "\n%%EOF";
    return $body;
}

function build_pdf_with_gd(array $paths): string
{
    $frames = [];
    foreach ($paths as $path) {
        $frame = gd_image_to_jpeg($path);
        if ($frame['data'] === '') {
            continue;
        }
        $frames[] = $frame;
    }
    if (empty($frames)) {
        return '';
    }
    return build_pdf_from_frames($frames);
}

function pdf_handle_export(): void
{
    $images = list_images();
    if (empty($images)) {
        respond_error(400, 'No screenshots captured; run a capture first.');
        return;
    }
    $paths = [];
    foreach ($images as $entry) {
        if (!isset($entry['filepath'])) {
            continue;
        }
        $paths[] = $entry['filepath'];
    }
    if (empty($paths)) {
        respond_error(500, 'No image paths found on disk.');
        return;
    }
    $pdfData = '';
    if (extension_loaded('imagick')) {
        $pdfData = build_pdf_with_imagick($paths);
    }
    if ($pdfData === '') {
        if (function_exists('imagecreatefrompng')) {
            $pdfData = build_pdf_with_gd($paths);
        }
    }
    if ($pdfData === '') {
        respond_error(500, 'Missing Imagick or GD support; install an image library.');
        return;
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="screenshots.pdf"');
    header('Content-Length: ' . strlen($pdfData));
    echo $pdfData;
}
