import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AdminSubmissionStatus } from '../types/adminTypes'
import { submissionStatusMeta } from '../utils/submissions'

export function SubmissionStatusBadge({ status }: { status: AdminSubmissionStatus }) {
  const meta = submissionStatusMeta[status]
  return <Badge variant="outline" className={cn('font-medium', meta?.tone)}>{meta?.label ?? status}</Badge>
}
