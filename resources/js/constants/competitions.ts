export type Competition = {
  id: string
  name: string
  description: string
  image: string        // e.g. '/images/mascot-olympiad.png' — leave '' to show a placeholder box
  guidebookUrl: string // external guidebook link — '#' until you have it
}
export const COMPETITIONS: Competition[] = [
  {
    id: 'is-olympiad',
    name: 'Olympiad',
    description: 'Information System Olympiad (ISO) adalah kompetisi olimpiade berskala nasional di bidang Teknologi Informasi dan Bisnis yang ditujukan bagi siswa/siswi SMA/SMK/sederajat. Berkompetisi secara individu melalui rangkaian Elimination, Semifinal, dan Final, ISO menguji kedalaman pemahaman teoretis sekaligus logika algoritmik peserta dalam melihat bagaimana teknologi menjadi fondasi bisnis modern. ISO hadir sebagai langkah awal untuk mengasah kompetensi dan mencetak talenta digital berprestasi di masa depan.',
    image: '/images/robot.png',
    guidebookUrl: '#',
  },
  {
    id: 'business-plan-competition',
    name: 'Business Plan',
    description: 'Business Plan Competition (BPC) adalah kompetisi penyusunan rencana bisnis berskala nasional yang ditujukan bagi siswa/siswi SMA/SMK/sederajat, berkompetisi dalam tim beranggotakan 3 orang. Peserta ditantang merumuskan ide bisnis di bidang IT yang realistis, berkelanjutan, dan berdampak sosial — mulai dari identifikasi peluang dan analisis pasar, hingga strategi pemasaran dan keuangan. BPC menjadi wadah strategis untuk mengasah insting kewirausahaan dan membangun portofolio kompetitif sejak dini.',
    image: '/images/action_plan.png',
    guidebookUrl: '#',
  },
  {
    id: 'business-it-case-competition',
    name: 'Business IT Case',
    description: 'Business IT Case Competition (BIC) adalah business case competition berskala nasional yang menantang mahasiswa aktif untuk melatih daya analitis kritis dalam membedah permasalahan industri riil. Berkompetisi dalam tim beranggotakan 3 orang, peserta memformulasikan dan mempresentasikan solusi strategis bagi perusahaan melalui implementasi Bisnis dan Teknologi Informasi (IT) yang komprehensif dan strategis.',
    image: '/images/robot.png',
    guidebookUrl: '#',
  },
]