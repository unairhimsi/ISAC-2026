<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    @php
        $appName = config('app.name', 'ISAC 2026');
        $appUrl = rtrim(config('app.url', url('/')), '/');
        $defaultDescription = 'Kompetisi informatika tahunan HIMSI Universitas Airlangga bertema Symphony of System — Olimpiade, Business Plan & Business IT Case. Pendaftaran 23 Agustus – 31 Oktober 2026 di Surabaya.';
        $defaultImage = $appUrl . '/images/og-isac-2026.jpg';
    @endphp
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title inertia>{{ $appName }}</title>
    <meta name="description" content="{{ $defaultDescription }}">
    <meta name="application-name" content="{{ $appName }}">
    <meta name="author" content="{{ $appName }}">
    <meta name="theme-color" content="#020617">
    <meta name="color-scheme" content="dark light">
    <meta property="og:title" content="{{ $appName }} — Symphony of System">
    <meta property="og:description" content="{{ $defaultDescription }}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ $appUrl }}">
    <meta property="og:image" content="{{ $defaultImage }}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga">
    <meta property="og:site_name" content="{{ $appName }}">
    <meta property="og:locale" content="id_ID">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $appName }} — Symphony of System">
    <meta name="twitter:description" content="{{ $defaultDescription }}">
    <meta name="twitter:image" content="{{ $defaultImage }}">
    <meta name="twitter:image:alt" content="ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga">
    @if (config('seo.google_site_verification'))
        <meta name="google-site-verification" content="{{ config('seo.google_site_verification') }}">
    @endif
    <link rel="icon" href="/favicon.svg" sizes="any">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="sitemap" type="application/xml" href="/sitemap.xml">
    @include('partials.seo-ld')
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="font-sans antialiased bg-background text-foreground">
    @inertia
</body>
</html>
