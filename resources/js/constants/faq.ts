export interface FaqItem {
  id: string
  question: string
  answer: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Bagaimana alur pendaftaran ISAC 2026 dari awal sampai selesai?',
    answer:
      'Pendaftaran dimulai dengan membuat akun menggunakan email dan password, lalu verifikasi email dengan kode yang dikirim ke inbox kamu. Setelah akun terverifikasi, kamu memilih salah satu cabang lomba (IS Olympiad, Business Plan Competition, atau Business IT Case Competition), mengisi Data Tim, Biodata Anggota, dan mengunggah Dokumen. Setelah itu kamu menyelesaikan tahap Pembayaran, lalu tim akan masuk status Menunggu Verifikasi hingga direview oleh panitia.',
  },
  {
    id: 'faq-2',
    question: 'Ada berapa gelombang (batch) pendaftaran dan berapa biayanya?',
    answer:
      'Pendaftaran ISAC 2026 dibuka dalam 2 gelombang untuk seluruh cabang lomba: Batch 1 (26 Agustus – 20 September 2026) dan Batch 2 (21 September – 14 Oktober 2026), dengan Closing Registration pada 14 Oktober 2026. Biaya per cabang naik di Batch 2: IS Olympiad Rp60.000 → Rp80.000, Business Plan Competition Rp70.000 → Rp90.000, dan Business IT Case Competition Rp80.000 → Rp100.000. Semakin cepat daftar, semakin murah biayanya.',
  },
  {
    id: 'faq-3',
    question: 'Berapa jumlah anggota tim yang dibutuhkan untuk masing-masing lomba?',
    answer:
      'IS Olympiad diikuti secara individu (1 peserta), sedangkan Business Plan Competition dan Business IT Case Competition sama-sama diikuti secara tim beranggotakan 3 orang. Untuk lomba beregu, satu anggota wajib didaftarkan sebagai ketua tim (leader) dan dua lainnya sebagai anggota.',
  },
  {
    id: 'faq-4',
    question: 'Dokumen apa saja yang perlu disiapkan sebelum submit pendaftaran?',
    answer:
      'Kamu perlu menyiapkan folder Google Drive berisi seluruh dokumen persyaratan sesuai Guidebook cabang lomba yang diikuti, serta folder terpisah berisi screenshot twibbon. Pastikan akses folder diatur agar "siapa pun dengan tautan ini" bisa membukanya, karena panitia akan meninjau folder tersebut langsung saat proses verifikasi.',
  },
  {
    id: 'faq-5',
    question: 'Metode pembayaran apa saja yang tersedia?',
    answer:
      'Pembayaran dilakukan melalui transfer bank ke rekening resmi panitia (BCA atau BNI). Setelah membayar, unggah bukti pembayaran pada halaman Payment agar dapat diperiksa dan diverifikasi oleh panitia.',
  },
  {
    id: 'faq-6',
    question: 'Apakah ada kode promo atau diskon pendaftaran?',
    answer:
      'Ya, ISAC 2026 menyediakan kode promo yang bisa dimasukkan di halaman pembayaran untuk mendapatkan potongan harga. Kamu bisa mengecek rincian harga setelah diskon sebelum submit — namun setelah pembayaran disubmit, kode promo yang sudah terpakai tidak bisa diubah lagi.',
  },
]
