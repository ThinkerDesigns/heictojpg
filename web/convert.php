<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit('POST only');
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    header('Content-Type: application/json');
    exit(json_encode(['error' => 'No HEIC file was uploaded.']));
}

$upload = $_FILES['file'];
$extension = strtolower(pathinfo($upload['name'], PATHINFO_EXTENSION));
if (!in_array($extension, ['heic', 'heif'], true)) {
    http_response_code(415);
    header('Content-Type: application/json');
    exit(json_encode(['error' => 'Only HEIC and HEIF files are supported.']));
}

$input = tempnam(sys_get_temp_dir(), 'switchback-in-');
$output = tempnam(sys_get_temp_dir(), 'switchback-out-') . '.jpg';
if ($input === false || !move_uploaded_file($upload['tmp_name'], $input)) {
    http_response_code(500);
    header('Content-Type: application/json');
    exit(json_encode(['error' => 'The server could not store the upload.']));
}

$commands = [];
if (PHP_OS_FAMILY === 'Darwin' && is_executable('/usr/bin/sips')) {
    $commands[] = ['/usr/bin/sips', ['-s', 'format', 'jpeg', $input, '--out', $output]];
}
$commands[] = ['magick', [$input, $output]];
$commands[] = ['convert', [$input, $output]];

$converted = false;
foreach ($commands as [$binary, $arguments]) {
    $command = escapeshellcmd($binary);
    foreach ($arguments as $argument) $command .= ' ' . escapeshellarg($argument);
    $status = 1;
    exec($command . ' 2>&1', $logs, $status);
    if ($status === 0 && is_file($output) && filesize($output) > 0) {
        $converted = true;
        break;
    }
}

if (!$converted) {
    @unlink($input);
    @unlink($output);
    http_response_code(503);
    header('Content-Type: application/json');
    exit(json_encode(['error' => 'No HEIC-capable converter is installed on this Apache host. Install ImageMagick with HEIC support.']));
}

$filename = preg_replace('/\.(heic|heif)$/i', '', basename($upload['name'])) . '.jpg';
header('Content-Type: image/jpeg');
header('Content-Disposition: attachment; filename="' . addcslashes($filename, '"\\') . '"');
header('Content-Length: ' . filesize($output));
readfile($output);
@unlink($input);
@unlink($output);
