export type ContactBranch = 'IS Olympiad' | 'Business Plan Competition' | 'Business IT Case Competition'

export interface ContactPerson {
  id: string
  name: string
  phoneLocal: string
  phoneIntl: string
}

export interface ContactGroup {
  branch: ContactBranch
  contacts: ContactPerson[]
}

export const CONTACT_GROUPS: ContactGroup[] = [
  {
    branch: 'IS Olympiad',
    contacts: [
      { id: 'cp-padma', name: 'Padma', phoneLocal: '081217827649', phoneIntl: '6281217827649' },
      { id: 'cp-abiyan', name: 'Abiyan', phoneLocal: '081818898281', phoneIntl: '6281818898281' },
    ],
  },
  {
    branch: 'Business Plan Competition',
    contacts: [
      { id: 'cp-ezi', name: 'Ezi', phoneLocal: '081222152006', phoneIntl: '6281222152006' },
      { id: 'cp-ava', name: 'Ava', phoneLocal: '082265467478', phoneIntl: '6282265467478' },
    ],
  },
  {
    branch: 'Business IT Case Competition',
    contacts: [
      { id: 'cp-fairuz', name: 'Fairuz', phoneLocal: '081311785646', phoneIntl: '6281311785646' },
      { id: 'cp-hana', name: 'Hana', phoneLocal: '081232599216', phoneIntl: '6281232599216' },
    ],
  },
]

export const CONTACT_INSTAGRAM_URL = 'https://www.instagram.com/isac_unair/'
export const CONTACT_INSTAGRAM_LABEL = '@isac_unair'
export const CONTACT_EMAIL = 'isacunair2026@gmail.com'

export function buildWaLink(contact: ContactPerson, message?: string): string {
  const base = `https://wa.me/${contact.phoneIntl}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
