import { APP_NAME } from '@/constants/app';
import type { SeoRobots } from '@/types/seo';

const viteSiteUrl = import.meta.env.VITE_APP_URL as string | undefined;
const runtimeSiteUrl = typeof window !== 'undefined' ? window.location.origin : '';

export const DEFAULT_SEO = {
    appName: APP_NAME,
    defaultTitle: APP_NAME,
    titleTemplate: `%s | ${APP_NAME}`,
    defaultDescription:
        'Kompetisi informatika tahunan HIMSI Universitas Airlangga bertema Symphony of System — Olimpiade, Business Plan & Business IT Case. Pendaftaran 23 Agustus – 31 Oktober 2026 di Surabaya.',
    defaultImage: '/images/og-isac-2026.jpg',
    defaultImageAlt: 'ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga',
    locale: 'id_ID',
    type: 'website',
    twitterCard: 'summary_large_image',
    keywords: [
        'ISAC 2026',
        'ISAC UNAIR',
        'HIMSI UNAIR',
        'Symphony of System',
        'Olimpiade Informatika',
        'Business Plan Competition',
        'Business IT Case',
        'Kompetisi Mahasiswa',
        'Lomba Informatika',
        'Universitas Airlangga',
        'Surabaya',
    ],
    robots: {
        index: true,
        follow: true,
    } satisfies SeoRobots,
    siteUrl: viteSiteUrl || runtimeSiteUrl,
} as const;
