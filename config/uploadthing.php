<?php

$images = ['image/jpeg', 'image/png', 'image/webp'];
$adminRoles = ['super_admin', 'admin_registration', 'judge'];

return [
    'token' => env('UPLOADTHING_TOKEN'),
    'callback_url' => env('UPLOADTHING_CALLBACK_URL'),
    'is_dev' => (bool) env('UPLOADTHING_IS_DEV', false),
    'client_version' => '7.7.4',
    'presigned_ttl' => 3600,
    'routes' => [
        'paymentProof' => [
            'purpose' => 'PAYMENT_PROOF',
            'types' => [...$images, 'application/pdf'],
            'max_size' => 10 * 1024 * 1024,
            'team' => true,
            'admin_roles' => [],
        ],
        'memberPhoto' => [
            'purpose' => 'MEMBER_PHOTO',
            'types' => $images,
            'max_size' => 5 * 1024 * 1024,
            'team' => true,
            'admin_roles' => ['super_admin', 'admin_registration'],
        ],
        'submission' => [
            'purpose' => 'SUBMISSION',
            'types' => [...$images, 'application/pdf'],
            'max_size' => 20 * 1024 * 1024,
            'team' => true,
            'admin_roles' => [],
        ],
        'batchModule' => [
            'purpose' => 'BATCH_MODULE',
            'types' => ['application/pdf'],
            'max_size' => 20 * 1024 * 1024,
            'team' => false,
            'admin_roles' => $adminRoles,
        ],
        'examImage' => [
            'purpose' => 'EXAM_IMAGE',
            'types' => $images,
            'max_size' => 5 * 1024 * 1024,
            'team' => false,
            'admin_roles' => $adminRoles,
        ],
    ],
];
