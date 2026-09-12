<!DOCTYPE html>
<html lang="<?php echo e(str_replace('_', '-', app()->getLocale())); ?>">
<head>
    <?php
        $appName = config('app.name', 'ISAC 2026');
        $appUrl = rtrim(config('app.url', url('/')), '/');
        $defaultDescription = 'Kompetisi informatika tahunan HIMSI Universitas Airlangga bertema Symphony of System — Olimpiade, Business Plan & Business IT Case. Pendaftaran 23 Agustus – 31 Oktober 2026 di Surabaya.';
        $defaultImage = $appUrl . '/images/og-isac-2026.jpg';
    ?>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title inertia><?php echo e($appName); ?></title>
    <meta name="description" content="<?php echo e($defaultDescription); ?>">
    <meta name="application-name" content="<?php echo e($appName); ?>">
    <meta name="author" content="<?php echo e($appName); ?>">
    <meta name="theme-color" content="#020617">
    <meta name="color-scheme" content="dark light">
    <meta property="og:title" content="<?php echo e($appName); ?> — Symphony of System">
    <meta property="og:description" content="<?php echo e($defaultDescription); ?>">
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo e($appUrl); ?>">
    <meta property="og:image" content="<?php echo e($defaultImage); ?>">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga">
    <meta property="og:site_name" content="<?php echo e($appName); ?>">
    <meta property="og:locale" content="id_ID">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo e($appName); ?> — Symphony of System">
    <meta name="twitter:description" content="<?php echo e($defaultDescription); ?>">
    <meta name="twitter:image" content="<?php echo e($defaultImage); ?>">
    <meta name="twitter:image:alt" content="ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga">
    <?php if(config('seo.google_site_verification')): ?>
        <meta name="google-site-verification" content="<?php echo e(config('seo.google_site_verification')); ?>">
    <?php endif; ?>
    <link rel="icon" href="/favicon.svg" sizes="any">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="sitemap" type="application/xml" href="/sitemap.xml">
    <?php echo $__env->make('partials.seo-ld', array_diff_key(get_defined_vars(), ['__data' => 1, '__path' => 1]))->render(); ?>
    <meta name="csrf-token" content="<?php echo e(csrf_token()); ?>">

    <?php echo app('Illuminate\Foundation\Vite')->reactRefresh(); ?>
    <?php echo app('Illuminate\Foundation\Vite')(['resources/css/app.css', 'resources/js/app.tsx']); ?>
    <?php $__inertiaSsrResponse = app(\Inertia\Ssr\SsrState::class)->setPage($page)->dispatch();  if ($__inertiaSsrResponse) { echo $__inertiaSsrResponse->head; } ?>
</head>
<body class="font-sans antialiased bg-background text-foreground">
    <?php $__inertiaSsrResponse = app(\Inertia\Ssr\SsrState::class)->setPage($page)->dispatch();  if ($__inertiaSsrResponse) { echo $__inertiaSsrResponse->body; } else { ?><script data-page="app" type="application/json"><?php echo json_encode($page); ?></script><div id="app"></div><?php } ?>
</body>
</html>
<?php /**PATH /var/www/html/resources/views/app.blade.php ENDPATH**/ ?>