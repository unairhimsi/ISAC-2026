export type TimelineEvent = {
  id: string
  day: string
  tag: string
  label: string
}

export const TIMELINE: TimelineEvent[] = [
  { id: 'pendaftaran', day: '26 Agu - 14 Okt', tag: 'Batch 1 & 2', label: 'Pendaftaran ISAC 2026' },
  { id: 'persiapan', day: '15 - 23 Okt', tag: 'Semua Cabang', label: 'Technical Meeting, Mentoring & Tryout' },
  { id: 'preliminary', day: '16 - 26 Okt', tag: 'Semua Cabang', label: 'Preliminary & Elimination' },
  { id: 'semifinal', day: '27 Okt - 14 Nov', tag: 'Semua Cabang', label: 'Semifinal & Pengumuman Finalis' },
  { id: 'persiapan-final', day: '14 - 15 Nov', tag: 'Finalis', label: 'Persiapan Final' },
  { id: 'final-awarding', day: '22 Nov', tag: 'Semua Cabang', label: 'Final & Awarding ISAC 2026' },
]
