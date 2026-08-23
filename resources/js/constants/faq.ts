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
      'Pendaftaran dimulai dengan membuat akun menggunakan email dan password, lalu verifikasi email dengan kode yang dikirim ke inbox kamu. Setelah akun terverifikasi, kamu memilih salah satu cabang lomba (IS Olympiad, Business Plan Competition, atau Business IT Case Competition), mengisi Data Tim, Biodata Anggota, dan mengunggah Dokumen. Setelah itu kamu menyelesaikan tahap Pembayaran sesuai skema masing-masing lomba, lalu tim akan masuk status Menunggu Verifikasi hingga direview oleh panitia.',
  },
  {
    id: 'faq-2',
    question: 'Apakah saya bisa membuat akun kapan saja, atau harus menunggu batch dibuka?',
    answer:
      'Pembuatan akun dan verifikasi email bisa dilakukan kapan saja. Namun, pemilihan cabang lomba hanya bisa dilakukan selama batch pendaftaran kompetisi tersebut berstatus terbuka dan kuotanya masih tersedia — begitu sebuah batch penuh atau melewati tanggal tutupnya, kamu perlu menunggu batch berikutnya dibuka (jika masih tersedia).',
  },
  {
    id: 'faq-3',
    question: 'Ada berapa gelombang (batch) pendaftaran dan berapa biayanya?',
    answer:
      'Pendaftaran ISAC 2026 dibuka dalam 2 gelombang untuk seluruh cabang lomba: Batch 1 (23 Agustus – 12 September 2026) dan Batch 2 (13–23 September 2026), dengan Closing Registration pada 23 September 2026. Biaya per cabang naik di Batch 2: IS Olympiad Rp60.000 → Rp80.000, Business Plan Competition Rp70.000 → Rp90.000, dan Business IT Case Competition Rp80.000 → Rp100.000. Semakin cepat daftar, semakin murah biayanya.',
  },
  {
    id: 'faq-4',
    question: 'Apa perbedaan skema pembayaran UPFRONT dan SEMIFINAL?',
    answer:
      'IS Olympiad menggunakan skema UPFRONT — kamu membayar biaya pendaftaran dan mengunggah bukti bayar langsung setelah melengkapi Data Tim, Biodata, dan Dokumen, sebelum masuk antrean verifikasi. Business Plan Competition dan Business IT Case Competition menggunakan skema SEMIFINAL — kamu menyelesaikan seluruh data pendaftaran tanpa membayar dulu, dan baru diminta membayar saat panitia meloloskan timmu ke tahap Semifinal.',
  },
  {
    id: 'faq-5',
    question: 'Berapa jumlah anggota tim yang dibutuhkan untuk masing-masing lomba?',
    answer:
      'IS Olympiad diikuti secara individu (1 peserta), sedangkan Business Plan Competition dan Business IT Case Competition sama-sama diikuti secara tim beranggotakan 3 orang. Untuk lomba beregu, satu anggota wajib didaftarkan sebagai ketua tim (leader) dan dua lainnya sebagai anggota.',
  },
  {
    id: 'faq-6',
    question: 'Data apa saja yang perlu diisi pada tahap Data Tim dan Biodata Anggota?',
    answer:
      'Pada tahap Data Tim, kamu mengisi nama tim, email & nomor telepon kontak, serta nama dan alamat institusi (sekolah/kampus). Pada tahap Biodata Anggota, setiap anggota — termasuk ketua tim — mengisi data lengkap seperti nama, email, NISN/NIM, jenis kelamin, tempat & tanggal lahir, alamat, agama, jurusan/program studi, ukuran kaos, hingga kontak darurat.',
  },
  {
    id: 'faq-7',
    question: 'Dokumen apa saja yang perlu disiapkan sebelum submit pendaftaran?',
    answer:
      'Kamu perlu menyiapkan folder Google Drive berisi seluruh dokumen persyaratan sesuai Guidebook cabang lomba yang diikuti, serta folder terpisah berisi screenshot twibbon. Pastikan akses folder diatur agar "siapa pun dengan tautan ini" bisa membukanya, karena panitia akan meninjau folder tersebut langsung saat proses verifikasi.',
  },
  {
    id: 'faq-8',
    question: 'Metode pembayaran apa saja yang tersedia?',
    answer:
      'Pembayaran dilakukan melalui transfer bank ke rekening resmi panitia (BCA atau BNI). Setelah membayar, unggah bukti pembayaran pada halaman Payment agar dapat diperiksa dan diverifikasi oleh panitia.',
  },
  {
    id: 'faq-9',
    question: 'Apakah ada kode promo atau diskon pendaftaran?',
    answer:
      'Ya, ISAC 2026 menyediakan kode promo yang bisa dimasukkan di halaman pembayaran untuk mendapatkan potongan harga. Kamu bisa mengecek rincian harga setelah diskon sebelum submit — namun setelah pembayaran disubmit, kode promo yang sudah terpakai tidak bisa diubah lagi.',
  },
  {
    id: 'faq-10',
    question: 'Berapa lama proses verifikasi setelah saya submit pendaftaran atau pembayaran?',
    answer:
      'Setelah submit, status pendaftaranmu berubah menjadi Menunggu Verifikasi. Panitia akan meninjau data tim dan bukti pembayaran secara terpisah, lalu mengubah status menjadi Terverifikasi, Perlu Revisi, atau Ditolak. Kamu bisa memantau status ini kapan saja lewat halaman Dashboard.',
  },
  {
    id: 'faq-11',
    question: "Apa yang harus saya lakukan jika status saya 'Perlu Revisi'?",
    answer:
      'Panitia akan menandai tahap mana yang perlu diperbaiki — Data Tim, Biodata Anggota, atau Dokumen. Kamu akan diarahkan langsung ke tahap tersebut untuk memperbaiki data, lalu submit ulang. Setelah disubmit ulang, statusmu kembali berubah menjadi Menunggu Verifikasi untuk ditinjau ulang oleh panitia.',
  },
  {
    id: 'faq-12',
    question: 'Bagaimana jika tim atau pembayaran saya ditolak (Rejected)?',
    answer:
      'Jika data tim atau pembayaranmu dinyatakan Ditolak oleh panitia, segera hubungi contact person (CP) cabang lomba yang kamu ikuti untuk informasi lebih lanjut mengenai alasan penolakan dan kemungkinan langkah selanjutnya.',
  },
  {
    id: 'faq-13',
    question: 'Bagaimana proses pembayaran untuk Business Plan Competition dan Business IT Case Competition saat lolos Semifinal?',
    answer:
      'Setelah panitia menyatakan timmu lolos ke tahap Semifinal, halaman Payment akan otomatis terbuka di akunmu. Alur pembayarannya sama seperti skema di IS Olympiad — pilih metode bayar, masukkan kode promo (opsional), lalu unggah bukti pembayaran untuk diverifikasi panitia.',
  },
  {
    id: 'faq-14',
    question: 'Apa saja yang bisa saya lihat di Dashboard setelah pendaftaran selesai?',
    answer:
      'Dashboard menampilkan profil tim, informasi lomba & batch yang diikuti, status pendaftaran terkini, tahap kompetisi yang sedang berjalan (misalnya Elimination, Preliminary, atau Semifinal), serta ujian/submission yang tersedia sesuai progres timmu.',
  },
  {
    id: 'faq-15',
    question: 'Apakah saya bisa mengganti cabang lomba setelah memilihnya?',
    answer:
      'Pemilihan cabang lomba bersifat final begitu proses pendaftaran dibuat, karena batch, harga, dan alur pembayaran mengikuti lomba yang dipilih di awal. Jika terjadi kesalahan pilih lomba, segera hubungi panitia/CP terkait sebelum melanjutkan ke tahap berikutnya.',
  },
]