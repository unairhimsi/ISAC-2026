import type { ApiResponse } from '@/types/api'
import type {
  CompetitionType,
  RegistrationContext,
  RegistrationStatus,
  StageSummary,
} from '@/features/registrations/types/registrationTypes'

export type DashboardExam = {
  id: string
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  duration: number
  maxAttempts: number
  type?: string
}

export type DashboardSummary = RegistrationContext & {
  total?: number
  active?: number
  completed?: number
  team: RegistrationContext['team'] & {
    memberCount: number
    currentStage: StageSummary | null
  }
  payment: null | {
    status: RegistrationStatus
    amount: number
    originalAmount: number
    promoCode: string | null
    discountPercent: number
    discountAmount: number
    method: string | null
    submittedAt: string | null
    verifiedAt: string | null
    rejectionReason: string | null
    proof: null | { id: string; url: string; downloadUrl: string }
  }
  activities: { exams: DashboardExam[] }
  nextAction: string
}

export type DashboardSummaryResponse = ApiResponse<DashboardSummary>

export type DashboardCompetition = {
  id: string
  name: string
  type: CompetitionType
}

export type DashboardBatch = {
  id: string
  name: string
  price: number
}

export type ExamShellData = {
  exam: DashboardExam
  stage: StageSummary
  competition: DashboardCompetition
  batch: DashboardBatch
}

export type SubmissionWindow = {
  isOpen: boolean
  isOverdue: boolean
  remainingMs: number | null
  startDate: string | null
  endDate: string | null
}

export type SubmissionFileRef = {
  id: string
  fileId: string
  url: string
}

export type SubmissionData = {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_requested'
  score: number | null
  feedback: string | null
  submittedAt: string | null
  reviewedAt: string | null
  file: SubmissionFileRef | null
}

export type SubmissionShellData = {
  stage: StageSummary
  competition: DashboardCompetition
  batch: DashboardBatch
  window: SubmissionWindow
  submission: SubmissionData | null
  canSubmit: boolean
}

export type ExamShellResponse = ApiResponse<ExamShellData>
export type SubmissionShellResponse = ApiResponse<SubmissionShellData>
