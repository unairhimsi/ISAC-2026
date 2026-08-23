@php
    $seoAppUrl = rtrim(config('app.url', url('/')), '/');
    $seoSiteName = config('app.name', 'ISAC 2026');
    $seoOrganization = config('seo.organization_name');
    $seoInstagram = config('seo.instagram_url');
    $seoLogo = $seoAppUrl . '/images/og-isac-2026.jpg';
    $seoFavIcon = $seoAppUrl . '/android-chrome-512x512.png';
    $seoDescription = 'Kompetisi informatika tahunan HIMSI Universitas Airlangga bertema Symphony of System — Olimpiade, Business Plan & Business IT Case. Pendaftaran 23 Agustus – 31 Oktober 2026 di Surabaya.';

    $websiteLd = [
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'name' => $seoSiteName,
        'alternateName' => [
            'Information System Airlangga Competition',
            'ISAC',
            'isac.himsiunair.com',
        ],
        'url' => $seoAppUrl,
    ];

    $organizationLd = [
        '@context' => 'https://schema.org',
        '@type' => 'Organization',
        'name' => $seoOrganization,
        'url' => $seoAppUrl,
        'logo' => $seoFavIcon,
        'image' => $seoLogo,
        'sameAs' => array_values(array_filter([$seoInstagram])),
    ];

    $eventLd = [
        '@context' => 'https://schema.org',
        '@type' => 'Event',
        'name' => 'ISAC 2026 - Information System Airlangga Competition',
        'description' => $seoDescription,
        'startDate' => '2026-08-23T00:00:00+07:00',
        'endDate' => '2026-10-31T23:59:59+07:00',
        'eventStatus' => 'https://schema.org/EventScheduled',
        'eventAttendanceMode' => 'https://schema.org/OfflineEventAttendanceMode',
        'location' => [
            '@type' => 'Place',
            'name' => 'Universitas Airlangga',
            'address' => [
                '@type' => 'PostalAddress',
                'addressLocality' => 'Surabaya',
                'addressRegion' => 'Jawa Timur',
                'addressCountry' => 'ID',
            ],
        ],
        'image' => [$seoLogo, $seoFavIcon],
        'url' => $seoAppUrl,
        'organizer' => [
            '@type' => 'Organization',
            'name' => $seoOrganization,
            'url' => $seoAppUrl,
        ],
    ];
@endphp

<script type="application/ld+json">@json($websiteLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)</script>
<script type="application/ld+json">@json($organizationLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)</script>
<script type="application/ld+json">@json($eventLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)</script>
