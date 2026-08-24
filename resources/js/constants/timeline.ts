export type TimelineEvent = {
  id: string
  day: string
  tag: string
  label: string
}

export const TIMELINE: TimelineEvent[] = [
  { id: 'pendaftaran', day: '23 Agu - 23 Sep', tag: 'Batch 1 & 2', label: 'Pendaftaran ISAC 2026' },
  { id: 'persiapan', day: '24 - 30 Sep', tag: 'Semua Cabang', label: 'Technical Meeting, Mentoring & Tryout' },
  { id: 'preliminary', day: '25 Sep - 16 Okt', tag: 'Semua Cabang', label: 'Preliminary & Elimination' },
  { id: 'semifinal', day: '17 - 23 Okt', tag: 'Semua Cabang', label: 'Semifinal & Pengumuman Finalis' },
  { id: 'persiapan-final', day: '23 - 30 Okt', tag: 'Finalis', label: 'Persiapan Final' },
  { id: 'final-awarding', day: '31 Okt', tag: 'Semua Cabang', label: 'Final & Awarding ISAC 2026' },
]
