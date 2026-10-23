import type { ApiResponse } from '@/types/api'
import type { AuthAdmin, TeamStatus } from '@/features/auth/types/authTypes'
import type {
  BatchStatus,
  CompetitionStatus,
  CompetitionType,
  MemberRecord,
  PaymentFlow,
  RegistrationStatus,
  TeamProfile,
} from '@/features/registrations/types/registrationTypes'

export type AdminRole = AuthAdmin['role']

export type AdminCompetition = {
  id: string
  name: string
  slug: string
  description: string | null
  type: CompetitionType
  paymentFlow: PaymentFlow
  startDate: string
  endDate: string
  status: CompetitionStatus
  createdAt: string | null
  updatedAt: string | null
}

export type AdminBatch = {
  id: string
  competitionId: string
  name: string
  slug: string
  description: string | null
  startAt: string
  endAt: string
  price: string
  moduleFileId: string | null
  quota: number | null
  currentRegistrations: number
  remainingQuota: number | null
  status: BatchStatus
  createdAt: string | null
  updatedAt: string | null
}

export type StageType = 'registration' | 'submission' | 'selection' | 'exam' | 'interview' | 'announcement' | 'final'

export type AdminStage = {
  id: string
  competitionId: string
  competition: Pick<AdminCompetition, 'id' | 'name' | 'type'>
  name: string
  type: StageType
  description: string | null
  order: number
  startDate: string | null
  endDate: string | null
  isActive: boolean
  criteria: Record<string, unknown> | null
  examCount: number
  submissionCount: number
  teamCount: number
  createdAt: string | null
  updatedAt: string | null
}

export type StagePayload = {
  competition_id: string
  name: string
  type: StageType
  description?: string | null
  order: number
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
}

export type UpdateStagePayload = Omit<StagePayload, 'competition_id'>

export type AdminTeamRegistration = {
  id: string
  status: RegistrationStatus
  teamCompletedAt: string | null
  membersCompletedAt: string | null
  documentsCompletedAt: string | null
  submittedAt: string | null
  paymentRequiredAt: string | null
  paymentSubmittedAt: string | null
  paymentAvailable: boolean
  competition: AdminCompetition
  batch: AdminBatch | null
}

export type AdminAuditNote = {
  id: string
  action: string
  reason: string
  requestId: string | null
  adminName: string
  createdAt: string | null
}

export type AdminTeamSummary = {
  team: TeamProfile
  members: MemberRecord[]
  registration: AdminTeamRegistration | null
  auditLogs?: AdminAuditNote[]
  verificationNote?: string | null
  revisionStep?: string | null
  currentStage?: { id: string; name: string; order: number; type: string } | null
}

export type LaravelPagination<T> = {
  data: T[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    path: string
    per_page: number
    to: number | null
    total: number
  }
}

export type AdminTeamFilters = {
  page?: number
  per_page?: number
  search?: string
  status?: TeamStatus | ''
  competition_id?: string
  batch_id?: string
}

export type ExportFormat = 'xlsx' | 'pdf'

/** Filter ekspor sama dengan filter daftar tanpa `page`/`per_page`: server selalu mengekspor semua baris yang cocok. */
export type ExportTeamsFilters = Omit<AdminTeamFilters, 'page' | 'per_page'> & { format?: ExportFormat }

export type ExportPaymentsFilters = Omit<AdminPaymentFilters, 'page' | 'per_page'> & { format?: ExportFormat }

export type CompetitionFilters = {
  page?: number
  perPage?: number
  search?: string
  type?: CompetitionType | ''
  status?: CompetitionStatus | ''
}

export type CompetitionPayload = {
  name: string
  slug?: string
  description?: string | null
  type: CompetitionType
  payment_flow: PaymentFlow
  start_date: string
  end_date: string
  status: CompetitionStatus
}

export type BatchPayload = {
  competition_id: string
  name: string
  slug: string
  description?: string | null
  start_date: string
  end_date: string
  price: number
  module_file_id?: string | null
  quota?: number | null
  status: BatchStatus
}

export type TeamRevisionPayload = {
  revision_step: 'TEAM' | 'MEMBERS' | 'DOCUMENTS'
  verification_note: string
}

export type AdminMemberUpdatePayload = {
  id?: string
  name: string
  role: MemberRecord['role']
  email: string
  major: string | null
  faculty: string | null
  student_id: string
  photo_file_id?: string | null
  sort_order?: number
}

export type AdminTeamUpdatePayload = {
  team: {
    name: string
    phone: string
    institution_name: string
    institution_address: string
  }
  members: AdminMemberUpdatePayload[]
  documents: {
    document_url: string
    twibbon_url: string
  }
  reason?: string
}

export type PaymentMethod = 'BANK_TRANSFER' | 'QRIS'
export type PaymentContext = 'REGISTRATION' | 'SEMIFINAL'

export type AdminPaymentProof = {
  id: string
  fileId: string
  url: string
  purpose?: string
  name?: string
}

export type AdminPaymentTeam = {
  id: string
  code: string
  name: string | null
  email: string
  phone: string | null
  institutionName: string | null
  institutionAddress: string | null
  status: string
  currentStage: { id: string; name: string } | null
}

export type AdminPaymentCompetition = {
  id: string
  name: string
  type: CompetitionType
  paymentFlow: PaymentFlow
}

export type AdminPaymentBatch = {
  id: string
  name: string
  price: string
}

export type AdminPaymentDetail = {
  method: PaymentMethod | null
  transactionId?: string | null
  originalAmount: string
  amountPaid: string
  promoCode: string | null
  discountPercent: string
  discountAmount: string
  proof: AdminPaymentProof | null
  requiredAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  paidAt: string | null
  rejectionReason: string | null
  targetStage: { id: string; name: string } | null
  reviewedBy: { id: string; name: string } | null
}

export type AdminPayment = {
  registrationId: string
  status: RegistrationStatus
  paymentContext: PaymentContext
  isSubmitted: boolean
  canBeReviewed: boolean
  team: AdminPaymentTeam
  competition: AdminPaymentCompetition
  batch: AdminPaymentBatch | null
  payment: AdminPaymentDetail
}

export type AdminPaymentFilters = {
  page?: number
  per_page?: number
  search?: string
  status?: RegistrationStatus | ''
  competition_id?: string
  batch_id?: string
  payment_method?: PaymentMethod | ''
}

export type AdminTeamsResponse = ApiResponse<LaravelPagination<AdminTeamSummary>>
export type AdminTeamResponse = ApiResponse<AdminTeamSummary>
export type AdminCompetitionsResponse = ApiResponse<AdminCompetition[]> & {
  metadata: { pagination: { page: number; perPage: number; total: number; lastPage: number } }
}
export type AdminCompetitionResponse = ApiResponse<AdminCompetition>
export type AdminBatchesResponse = ApiResponse<AdminBatch[]>
export type AdminBatchResponse = ApiResponse<AdminBatch>
export type DeleteResponse = ApiResponse<null>
export type AdminStagesResponse = ApiResponse<AdminStage[]>
export type AdminStageResponse = ApiResponse<AdminStage>

export type AdminStageScoreMode = 'exam' | 'submission'

export type AdminStageScoreEntry = {
  teamId: string
  score: number | null
  maxScore?: number | null
  finishedAttempts?: number
  attemptCount?: number
  flagged?: boolean
  submissionStatus?: string | null
}

export type AdminStageScores = {
  mode: AdminStageScoreMode
  stage: { id: string; name: string; order: number; type: string }
  scores: AdminStageScoreEntry[]
}

export type AdminStageScoresResponse = ApiResponse<AdminStageScores>

export type AdminPaymentsResponse = ApiResponse<LaravelPagination<AdminPayment>>
export type AdminPaymentResponse = ApiResponse<AdminPayment>

export type AdminOperationAction = 'VERIFY_TEAM' | 'VERIFY_PAYMENT' | 'VERIFY_TEAM_PAYMENT' | 'ADVANCE_STAGE' | 'ANNOUNCE_RESULT'
export type AdminOperationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED'
export type SpreadsheetStatus = 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED' | 'SKIPPED'

export type AdminOperationItem = {
  id: string
  team: { id: string; code: string; name: string | null } | null
  statusBefore: string | null
  statusAfter: string | null
  processingStatus: AdminOperationStatus | 'SKIPPED'
  spreadsheetStatus: SpreadsheetStatus
  lastError: string | null
  event: { eventId: string; status: SpreadsheetStatus; emailStatus: string } | null
}

export type AdminOperation = {
  id: string
  action: AdminOperationAction
  status: AdminOperationStatus
  totalItems: number
  processedItems: number
  successCount: number
  skippedCount: number
  failedCount: number
  announcement: { title: string | null; template: string | null }
  targetStage: { id: string; name: string; order: number } | null
  requestedBy: { id: string; name: string } | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string | null
  items?: AdminOperationItem[]
}

export type AdminOperationsResponse = ApiResponse<LaravelPagination<AdminOperation>>
export type AdminOperationResponse = ApiResponse<AdminOperation>

export type AdminOperationFilters = {
  page?: number
  per_page?: number
}

export type CreateAdminOperationPayload = {
  action: AdminOperationAction
  team_ids: string[]
  target_stage_id?: string | null
  sync_spreadsheet?: boolean
  announcement?: {
    title?: string | null
    template?: string | null
    message?: string | null
    send_notification?: boolean
  }
}


export type AdminExamStage = {
  id: string
  competitionId: string
  name: string
  description: string | null
  order: number
  startDate: string | null
  endDate: string | null
}

export type AdminExamSummary = {
  id: string
  stageId: string
  title: string
  startDate: string | null
  endDate: string | null
  questionCount: number
  attemptCount: number | null
  duration: number
  maxAttempts: number
}

export type AdminExamAttempt = {
  id: string
  examId: string
  teamId: string
  totalScore: number | null
  maxPossibleScore: number
  startTime: string | null
  endTime: string | null
  finished: boolean
  flagged: boolean
  cheatCount: number
  suspiciousScore: number
  deviceId: string | null
  team?: { id: string; name: string | null; code: string; email: string } | null
  exam?: { id: string; title: string } | null
}

export type AdminExamAttemptFilters = {
  page?: number
  per_page?: number
  search?: string
  flagged?: '0' | '1' | ''
}

export type AdminExamAttemptsPage = {
  data: AdminExamAttempt[]
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export type AdminAttemptQuestion = {
  id: string
  question: string
  type: string
  options: { id: string; content: string }[] | null
  correctAnswer?: string | string[] | null
  correctScore?: number
  wrongScore?: number
  emptyScore?: number
}

export type AdminAttemptAnswer = {
  id: string
  questionId: string
  question: AdminAttemptQuestion | null
  questionDeleted: boolean
  selectedOptions: string[] | null
  answer: string | null
  isCorrect: boolean | null
  scoreObtained: number | null
  timeSpent: number | null
  answeredAt: string | null
  correctAnswer: string | string[] | null
}

export type AdminAttemptTimelineEvent = {
  id: string
  type: string
  metadata: { weight?: number; raw_type?: string } & Record<string, unknown> | null
  createdAt: string | null
}

export type AdminExamAttemptDetail = {
  attempt: AdminExamAttempt
  answers: AdminAttemptAnswer[]
  timeline: AdminAttemptTimelineEvent[]
}

export type AdminExamStagesResponse = ApiResponse<AdminExamStage[]>
export type AdminExamsResponse = ApiResponse<AdminExamSummary[]>
export type AdminExamAttemptsResponse = ApiResponse<AdminExamAttemptsPage>
export type AdminExamAttemptDetailResponse = ApiResponse<AdminExamAttemptDetail>
export type AdminExamAttemptScoreResponse = ApiResponse<AdminExamAttempt>

export type AdminMissingSubmissionState = 'not_started' | 'draft'

export type AdminMissingSubmissionFilters = {
  page?: number
  per_page?: number
  search?: string
  state?: AdminMissingSubmissionState | ''
}

export type AdminMissingSubmissionTeam = {
  id: string
  code: string
  name: string | null
  email: string
  phone: string | null
  institutionName: string | null
  currentStage: { id: string; name: string; order: number } | null
  state: AdminMissingSubmissionState
  /** Tahap sudah lewat batas waktu atau tim sudah dipindah ke tahap berikutnya. */
  lapsed: boolean
  advancedPast: boolean
  submission: {
    id: string
    title: string
    hasFile: boolean
    fileUrl: string | null
    /** Pernah dikumpulkan lalu ditarik kembali menjadi draft. */
    withdrawn: boolean
    updatedAt: string | null
  } | null
}

export type AdminMissingSubmissions = {
  competition: { id: string; name: string; type: CompetitionType }
  stage: { id: string; name: string; type: StageType; order: number; startDate: string | null; endDate: string | null }
  summary: { expected: number; submitted: number; missing: number; notStarted: number; draft: number }
  teams: {
    data: AdminMissingSubmissionTeam[]
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

export type AdminMissingSubmissionsResponse = ApiResponse<AdminMissingSubmissions>

export type AdminSubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_requested'
export type AdminSubmissionAction = Exclude<AdminSubmissionStatus, 'draft' | 'submitted'>

export type AdminSubmission = {
  id: string
  teamId: string
  stageId: string
  title: string
  description: string | null
  status: AdminSubmissionStatus
  score: number | null
  feedback: string | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  team?: { id: string; code: string; name: string | null } | null
  stage?: { id: string; name: string; type: StageType; order: number } | null
  file?: { id: string; fileId: string; url: string } | null
  reviewedByAdmin?: { id: string; name: string; email: string } | null
  createdAt: string | null
  updatedAt: string | null
}

export type AdminSubmissionFilters = {
  page?: number
  per_page?: number
  search?: string
  status?: AdminSubmissionStatus | ''
}

export type AdminSubmissionReviewPayload = {
  action: AdminSubmissionAction
  score?: number
  feedback?: string
}

export type AdminSubmissionsResponse = ApiResponse<LaravelPagination<AdminSubmission>>
export type AdminSubmissionResponse = ApiResponse<AdminSubmission>

export type AdminAdvancementState = 'eligible' | 'advanced' | 'blocked'

export type AdminAdvancementTeam = {
  team: { id: string; code: string; name: string | null; email: string }
  batch: { id: string; name: string } | null
  currentStage: { id: string; name: string; order: number } | null
  /** Hasil review tahap asal; hanya informasi, tidak membatasi pilihan admin. */
  submission: { id: string; status: AdminSubmissionStatus; score: number | null; submittedAt: string | null } | null
  state: AdminAdvancementState
  reason: string | null
}

export type AdminAdvancement = {
  competition: { id: string; name: string; type: CompetitionType }
  stage: { id: string; name: string; type: StageType; order: number; startDate: string | null; endDate: string | null }
  nextStage: { id: string; name: string; type: StageType; order: number; startDate: string | null; endDate: string | null } | null
  summary: { total: number; eligible: number; advanced: number; blocked: number }
  truncated: boolean
  teams: AdminAdvancementTeam[]
}

export type AdminAdvancementResponse = ApiResponse<AdminAdvancement>
