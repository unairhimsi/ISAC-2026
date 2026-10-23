import { FileX2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminCompetitions, useAdminStages } from '../hooks/useAdmin'

export const submissionCompetitionTags: Record<string, string> = { BUSINESS_PLAN: 'BPC', BUSINESS_IT_CASE: 'BIC' }

const selectClass = 'h-10 w-full rounded-3xl border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60'
const stepClass = 'flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary'

type Props = {
  competitionId: string
  stageId: string
  onChange: (patch: { competition?: string; stage?: string }) => void
  description: string
  children?: ReactNode
}

/** Pilih kompetisi BPC/BIC lalu tahapnya. Dipakai halaman submission belum masuk dan review submission. */
export function SubmissionStagePicker({ competitionId, stageId, onChange, description, children }: Props) {
  const competitionsQuery = useAdminCompetitions({ perPage: 100 })
  const stagesQuery = useAdminStages(competitionId || undefined)

  const competitions = (competitionsQuery.data?.data ?? []).filter((competition) => competition.type in submissionCompetitionTags)
  // Tanpa kompetisi terpilih, query tahap mengembalikan tahap semua kompetisi; jangan ditampilkan.
  // Tahap Final adalah presentasi, jadi hanya muncul kalau ternyata sudah ada submission di dalamnya
  // atau sedang dipilih lewat URL.
  const stages = competitionId
    ? [...(stagesQuery.data?.data ?? [])]
        .filter((stage) => stage.type !== 'final' || stage.submissionCount > 0 || stage.id === stageId)
        .sort((a, b) => a.order - b.order)
    : []

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileX2 className="size-4 text-primary" />Konteks Tahap</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className={stepClass}>1</span>Kompetisi</span>
            <select value={competitionId} onChange={(event) => onChange({ competition: event.target.value, stage: '' })} className={selectClass} disabled={competitionsQuery.isLoading}>
              <option value="">{competitionsQuery.isLoading ? 'Memuat...' : 'Pilih BPC atau BIC'}</option>
              {competitions.map((competition) => <option key={competition.id} value={competition.id}>{submissionCompetitionTags[competition.type]} · {competition.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className={stepClass}>2</span>Tahap</span>
            <select value={stageId} onChange={(event) => onChange({ stage: event.target.value })} className={selectClass} disabled={!competitionId || stagesQuery.isLoading}>
              <option value="">{!competitionId ? 'Pilih kompetisi dulu' : stagesQuery.isLoading ? 'Memuat...' : stages.length === 0 ? 'Belum ada tahap' : 'Pilih tahap'}</option>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>Tahap {stage.order} · {stage.name}</option>)}
            </select>
          </label>
        </div>
        {competitionsQuery.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{competitionsQuery.error.message}</p>}
        {stagesQuery.error && <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{stagesQuery.error.message}</p>}
        {children}
      </CardContent>
    </Card>
  )
}
