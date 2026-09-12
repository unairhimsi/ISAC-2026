import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Question = {
  id: string
  question: string
  correctAnswer?: string | null
  explanation?: string | null
  type: string
  correctScore?: number
  wrongScore?: number
  emptyScore?: number
}

type Attempt = {
  totalScore: number
  maxPossibleScore: number
  finished: boolean
}

export function TryoutResultPanel({
  attempt,
  questions,
  canViewResult,
}: {
  attempt: Attempt
  questions: Question[]
  canViewResult: boolean
}) {
  if (!canViewResult) {
    return (
      <Card className="border-white/10 bg-card/50 backdrop-blur-xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Hasil & pembahasan hanya tersedia untuk Tryout setelah selesai. Olimpiade akan diumumkan panitia.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-accent/25 bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Hasil Tryout — {attempt.totalScore}/{attempt.maxPossibleScore}
          <Badge variant="secondary">Tryout</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-2xl border border-white/10 bg-background/30 p-4">
            <p className="text-xs text-muted-foreground">Soal {idx + 1} · {q.type}</p>
            <div className="prose prose-sm mt-2 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: q.question }} />
            <p className="mt-3 text-sm font-medium">Kunci: {q.correctAnswer ?? '-'}</p>
            <p className="text-xs text-muted-foreground">Bobot benar {q.correctScore} · salah {q.wrongScore} · kosong {q.emptyScore}</p>
            {q.explanation && (
              <details className="mt-3 rounded-xl bg-muted/40 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">Lihat pembahasan</summary>
                <div className="prose prose-sm mt-3 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: q.explanation }} />
              </details>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
