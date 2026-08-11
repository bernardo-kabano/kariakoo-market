<?php
header('Content-Type: application/json; charset=utf-8');

function parseDotEnv(string $path): array {
    if (!file_exists($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $data = [];

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $pair = explode('=', $line, 2);
        if (count($pair) !== 2) {
            continue;
        }

        $key = trim($pair[0]);
        $value = trim($pair[1]);
        $data[$key] = trim($value, "\"'");
    }

    return $data;
}

$env = parseDotEnv(__DIR__ . '/../.env');
$response = [
    'firebaseConfig' => [
        'apiKey' => $env['VITE_FIREBASE_API_KEY'] ?? '',
        'authDomain' => $env['VITE_FIREBASE_AUTH_DOMAIN'] ?? '',
        'projectId' => $env['VITE_FIREBASE_PROJECT_ID'] ?? '',
        'storageBucket' => $env['VITE_FIREBASE_STORAGE_BUCKET'] ?? '',
        'messagingSenderId' => $env['VITE_FIREBASE_MESSAGING_SENDER_ID'] ?? '',
        'appId' => $env['VITE_FIREBASE_APP_ID'] ?? '',
        'measurementId' => $env['VITE_FIREBASE_MEASUREMENT_ID'] ?? '',
    ],
    'googleMapsKey' => $env['VITE_GOOGLE_MAPS_API_KEY'] ?? '',
];

echo json_encode($response, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
