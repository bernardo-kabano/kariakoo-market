<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No image file was uploaded.']);
    exit;
}

$file = $_FILES['image'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Image upload failed with error code ' . $file['error'] . '.']);
    exit;
}

$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$fileInfo = pathinfo($file['name']);
$extension = strtolower($fileInfo['extension'] ?? '');

if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unsupported image type. Use JPG, PNG, GIF, or WEBP.']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to create uploads directory.']);
    exit;
}

$safeBaseName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $fileInfo['filename'] ?? 'image');
$uniqueName = sprintf('%s_%s.%s', $safeBaseName, uniqid('', true), $extension);
$destination = $uploadDir . $uniqueName;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save uploaded image.']);
    exit;
}

$urlPath = '/uploads/' . $uniqueName;
echo json_encode(['success' => true, 'url' => $urlPath]);
