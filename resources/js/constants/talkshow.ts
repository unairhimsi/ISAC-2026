export interface TalkshowBenefit {
  id: string
  text: string
}

export interface TalkshowInfo {
  titlePrimary: string
  titleSecondary: string
  description: string
  contactPersonText: string
  contactPersonUrl: string
  registerText: string
  registerUrl: string
  image: string
}

export const TALKSHOW_INFO: TalkshowInfo = {
  titlePrimary: 'TALK',
  titleSecondary: 'SHOW',
  description:
    'Talkshow ISAC 2026 menghadirkan sesi diskusi bertema "Cyber Ring" sebagai bagian dari rangkaian Information Systems Airlangga Competition yang diselenggarakan oleh HIMSI UNAIR. Talkshow ini akan dilaksanakan pada bulan September 2026 dan terbuka bagi siswa/siswi SMA/SMK/sederajat yang ingin memperluas wawasan seputar sistem informasi, teknologi, dan bisnis secara langsung dari praktisi di bidangnya.',
  contactPersonText: 'Contact Person',
  contactPersonUrl: 'https://api.whatsapp.com/send/?phone=62895613128295&text&type=phone_number&app_absent=0',
  registerText: 'Register',
  registerUrl: '/auth/register',
  image: '/images/Union.png',
}

export const TALKSHOW_BENEFITS: TalkshowBenefit[] = [
  {
    id: 'benefit-1',
    text: 'Wawasan terkini seputar sistem informasi, teknologi, dan bisnis',
  },
  {
    id: 'benefit-2',
    text: 'Sesi sharing dan diskusi langsung bersama pembicara',
  },
  {
    id: 'benefit-3',
    text: 'Kesempatan bertanya pada sesi tanya jawab',
  },
  {
    id: 'benefit-4',
    text: 'Inspirasi dan bekal awal untuk mengembangkan potensi di era digital',
  },
]
