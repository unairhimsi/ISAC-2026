import { Link } from '@inertiajs/react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, CheckCircle2, Clock3, Inbox, Layers3, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Seo } from '@/components/seo/Seo'
import { useAuthSession } from '@/features/auth/context/AuthProvider'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { adminPageLayout } from '@/features/admin/components/AdminShell'
import { adminRoleLabels } from '@/constants/admin'
import { getJson } from '@/lib/api'

type Summary = {
  totals: { teams: number; waitingVerification: number; waitingPayment: number; verified: number }
  teamsByCompetition: { label: string; total: number }[]
  teamsByStatus: { label: string; total: number }[]
  activity: { date: string; label: string; total: number }[]
}

const stats = [
  { key: 'teams', label: 'Total Tim', icon: Users, tone: 'text-primary', background: 'bg-primary/10' },
  { key: 'waitingVerification', label: 'Menunggu Review Tim', icon: Clock3, tone: 'text-secondary', background: 'bg-secondary/10' },
  { key: 'waitingPayment', label: 'Menunggu Pembayaran', icon: Banknote, tone: 'text-amber-300', background: 'bg-amber-400/10' },
  { key: 'verified', label: 'Tim Terverifikasi', icon: CheckCircle2, tone: 'text-accent', background: 'bg-accent/10' },
] as const

function truncateLabel(value: string, max = 14) {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

const chartTooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  color: 'var(--foreground)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  fontSize: '12px',
} as const

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-background/20 p-6 text-center">
      <span className="rounded-2xl bg-muted p-3">
        <Inbox className="size-5 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="max-w-xs text-xs leading-4 text-muted-foreground">Data akan tampil otomatis setelah ada aktivitas tim atau pendaftaran kompetisi.</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { principal } = useAuthSession()
  const admin = principal?.principalType === 'ADMIN' ? principal.admin : null
  const canViewTeams = admin && ['super_admin', 'admin_registration', 'admin_payment'].includes(admin.role)
  const summary = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn: () => getJson<{ data: Summary }>('/api/admin/dashboard/summary'),
    staleTime: 30_000,
  })
  const data = summary.data?.data
  const hasCompetitionData = (data?.teamsByCompetition?.length ?? 0) > 0
  const hasActivityData = (data?.activity?.length ?? 0) > 0 && (data?.activity?.some((item) => item.total > 0) ?? false)

  return (
    <>
      <Seo title="Admin Dashboard" description="Pusat operasional Admin ISAC 2026." canonical="/admin/dashboard" noindex />
      <AdminPageHeader title={'Selamat datang' + (admin ? ', ' + admin.name : '')} description={admin ? adminRoleLabels[admin.role] + ' · Pantau antrean operasional dan akses modul administrasi ISAC 2026.' : 'Memuat profil admin...'} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan operasional">
        {stats.map(({ key, label, icon: Icon, tone, background }) => (
          <Card key={label} className="border-border/60 bg-card/70 backdrop-blur-md">
            <CardContent className="flex items-start justify-between p-5">
              <div><p className="text-sm text-muted-foreground">{label}</p>{summary.isLoading ? <Skeleton className="mt-3 h-9 w-16" /> : <p className="mt-3 text-3xl font-semibold text-foreground">{data?.totals[key] ?? 0}</p>}<p className="mt-1 text-xs text-muted-foreground">Data operasional real-time</p></div>
              <div className={'rounded-2xl p-2.5 ' + background + ' ' + tone}><Icon className="size-5" /></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="flex min-h-[360px] flex-col border-border/60 bg-card/70 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Tim per kompetisi</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Distribusi pendaftaran aktif per kompetisi · update tiap 30 detik</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-2">
            {summary.isLoading ? (
              <Skeleton className="h-[280px] w-full rounded-2xl sm:h-[300px]" />
            ) : !hasCompetitionData ? (
              <div className="h-[280px] sm:h-[300px]">
                <ChartEmptyState message="Belum ada data kompetisi" />
              </div>
            ) : (
              <div className="h-[300px] w-full sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.teamsByCompetition ?? []} margin={{ top: 8, right: 16, left: 0, bottom: 28 }} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      height={48}
                      angle={-14}
                      textAnchor="end"
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(value: string) => truncateLabel(String(value), 14)}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: 'color-mix(in srgb, var(--muted) 55%, transparent)' }}
                      contentStyle={chartTooltipStyle}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      formatter={(value) => [String(value ?? 0), 'Total Tim']}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[10, 10, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[360px] flex-col border-border/60 bg-card/70 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Aktivitas Admin · 7 hari</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Jumlah log audit harian · tren operasional mingguan</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-2">
            {summary.isLoading ? (
              <Skeleton className="h-[280px] w-full rounded-2xl sm:h-[300px]" />
            ) : !hasActivityData ? (
              <div className="h-[280px] sm:h-[300px]">
                <ChartEmptyState message="Belum ada aktivitas minggu ini" />
              </div>
            ) : (
              <div className="h-[300px] w-full sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.activity ?? []} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }} itemStyle={{ color: 'var(--foreground)' }} formatter={(value) => [String(value ?? 0), 'Aktivitas']} />
                    <Line type="monotone" dataKey="total" stroke="var(--secondary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)', stroke: 'var(--secondary)' }} activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--secondary)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card className="border-border/60 bg-card/70 backdrop-blur-md"><CardHeader><CardTitle className="text-base sm:text-lg">Antrean pekerjaan</CardTitle><CardDescription>Tap untuk langsung masuk ke antrean terkait</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{[{ label: 'Review data', value: data?.totals.waitingVerification ?? 0, href: '/admin/teams' }, { label: 'Review pembayaran', value: data?.totals.waitingPayment ?? 0, href: '/admin/payments' }, { label: 'Terverifikasi', value: data?.totals.verified ?? 0, href: '/admin/teams' }].map((item) => <Link key={item.label} href={item.href} className="rounded-2xl border border-border bg-background/30 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-2xl font-semibold">{item.value}</p><p className="mt-1 text-sm text-muted-foreground">{item.label}</p></Link>)}</CardContent></Card>
        <Card className="border-border/60 bg-card/70 backdrop-blur-md"><CardHeader><CardTitle className="text-base sm:text-lg">Akses cepat</CardTitle><CardDescription>Pintas modul yang sering dipakai sesuai role</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{canViewTeams && <Link href="/admin/teams" className="rounded-2xl border border-border p-4 transition-colors hover:border-secondary/30 hover:bg-secondary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Users className="size-5 text-secondary" /><p className="mt-2 text-sm font-medium">Verifikasi Tim</p><p className="text-xs text-muted-foreground">Review & revisi data tim</p></Link>}<Link href="/admin/questions" className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Layers3 className="size-5 text-primary" /><p className="mt-2 text-sm font-medium">Buat Soal</p><p className="text-xs text-muted-foreground">Kelola bank soal Olimpiade</p></Link></CardContent></Card>
      </section>
    </>
  )
}

AdminDashboard.layout = adminPageLayout
