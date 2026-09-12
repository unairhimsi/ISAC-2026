<?php

return [
    'payment_methods' => ['BANK_TRANSFER', 'QRIS'],
    'payment_instructions' => env('REGISTRATION_PAYMENT_INSTRUCTIONS', 'Ikuti instruksi pembayaran resmi panitia ISAC.'),
    'qris' => [
        'image_url' => env('REGISTRATION_QR_IMAGE_URL'),
    ],
    'promo' => [
        'code' => env('REGISTRATION_PROMO_CODE', 'ISAXOP'),
        'discount_percent' => (int) env('REGISTRATION_PROMO_DISCOUNT_PERCENT', 15),
    ],
    'bank_accounts' => [
        [
            'bank' => 'BCA',
            'account_number' => env('REGISTRATION_BCA_ACCOUNT_NUMBER', ''),
            'account_name' => env('REGISTRATION_BCA_ACCOUNT_NAME', ''),
        ],
        [
            'bank' => 'BNI',
            'account_number' => env('REGISTRATION_BNI_ACCOUNT_NUMBER', ''),
            'account_name' => env('REGISTRATION_BNI_ACCOUNT_NAME', ''),
        ],
    ],
];
