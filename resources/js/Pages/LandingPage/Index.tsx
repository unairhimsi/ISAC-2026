import React, { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Seo } from '@/components/seo/Seo'
import { AnimatedBackground } from '@/components/shared/AnimatedBackground'
import { FAQ_ITEMS } from '@/constants/faq'
// import { SectionDecor } from '@/components/shared/SectionDecor'
import { Hero } from "./sections/Hero";
import { Competitions } from "./sections/Competitions";
import { Timeline } from "./sections/Timeline";
import { Talkshow } from "./sections/Talkshow";
import { SponsorPartner } from "./sections/SponsorPartner";
import { Faq } from "./sections/Faq";
import { LandingBackground } from '@/components/shared/LandingBackground';

gsap.registerPlugin(useGSAP, ScrollTrigger)

const Index = () => {
  const mainRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    if (!mainRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const sections = gsap.utils.toArray<HTMLElement>(
      ':scope > section',
      mainRef.current,
    )

    sections.forEach((section) => {
      gsap.from(section, {
        autoAlpha: 0,
        y: 64,
        duration: 0.9,
        ease: 'power3.out',
        clearProps: 'opacity,transform,visibility',
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
          once: true,
        },
      })
    })
  }, { scope: mainRef })

  return (
    <>
      <Seo
        title="Symphony of System — Kompetisi Informatika HIMSI UNAIR"
        description="ISAC 2026 Symphony of System oleh HIMSI Universitas Airlangga — Olimpiade, Business Plan & Business IT Case di Surabaya. Pendaftaran 23 Agustus – 31 Oktober 2026, kuota batch terbatas."
        canonical="/"
        image="/images/og-isac-2026.jpg"
        imageAlt="ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga"
        keywords={['ISAC 2026', 'ISAC UNAIR', 'HIMSI UNAIR', 'Symphony of System', 'Olimpiade Informatika', 'Business Plan Competition', 'Business IT Case', 'Lomba Mahasiswa', 'Universitas Airlangga', 'Surabaya']}
        author="HIMSI Universitas Airlangga"
        type="website"
        openGraph={{
            title: "Symphony of System — Kompetisi Informatika HIMSI UNAIR",
            description: "ISAC 2026 Symphony of System oleh HIMSI Universitas Airlangga — Olimpiade, Business Plan & Business IT Case di Surabaya. Pendaftaran 23 Agustus – 31 Oktober 2026.",
            type: "website",
            url: "/",
            image: "/images/og-isac-2026.jpg",
            imageAlt: "ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga",
            siteName: "ISAC 2026",
            locale: "id_ID",
        }}
        twitter={{
            card: "summary_large_image",
            title: "Symphony of System — Kompetisi Informatika HIMSI UNAIR",
            description: "ISAC 2026 Symphony of System oleh HIMSI UNAIR — Olimpiade, Business Plan & Business IT Case. Pendaftaran 23 Agustus – 31 Oktober 2026.",
            image: "/images/og-isac-2026.jpg",
            imageAlt: "ISAC 2026 — Symphony of System oleh HIMSI Universitas Airlangga",
        }}
        jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                },
            })),
        } as unknown as import('@/types/seo').SeoJsonLd}
      />

      <LandingBackground />

      <main ref={mainRef} className="relative">
        <Hero />
        <Competitions />
        <Timeline />
        <Talkshow />
        <SponsorPartner />
        <Faq />
      </main>
    </>
  )
}

export default Index
