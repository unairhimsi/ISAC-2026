import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/adminApi'
import type { AdminOperationFilters, AdminPaymentFilters, AdminTeamFilters, AdminTeamUpdatePayload, BatchPayload, CompetitionFilters, CompetitionPayload, CreateAdminOperationPayload, StagePayload, TeamRevisionPayload, UpdateStagePayload } from '../types/adminTypes'

export const adminKeys = {
  all: ['admin'] as const,
  teams: (filters?: AdminTeamFilters) => [...adminKeys.all, 'teams', filters] as const,
  team: (teamId: string) => [...adminKeys.all, 'team', teamId] as const,
  competitions: (filters?: CompetitionFilters) => [...adminKeys.all, 'competitions', filters] as const,
  stages: (competitionId?: string) => [...adminKeys.all, 'stages', competitionId] as const,
  batches: (competitionId?: string) => [...adminKeys.all, 'batches', competitionId] as const,
  payments: (filters?: AdminPaymentFilters) => [...adminKeys.all, 'payments', filters] as const,
  payment: (registrationId: string) => [...adminKeys.all, 'payment', registrationId] as const,
  operations: (filters?: AdminOperationFilters) => [...adminKeys.all, 'operations', filters] as const,
  operation: (operationId: string) => [...adminKeys.all, 'operation', operationId] as const,
}

export function useAdminTeams(filters: AdminTeamFilters) {
  return useQuery({ queryKey: adminKeys.teams(filters), queryFn: () => adminApi.teams(filters) })
}

export function useAdminTeam(teamId: string) {
  return useQuery({ queryKey: adminKeys.team(teamId), queryFn: () => adminApi.team(teamId), enabled: Boolean(teamId) })
}

export function useVerifyAdminTeam(teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.verifyTeam(teamId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'teams'] }),
      client.invalidateQueries({ queryKey: adminKeys.team(teamId) }),
    ]),
  })
}

export function useReviseAdminTeam(teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: TeamRevisionPayload) => adminApi.reviseTeam(teamId, payload),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'teams'] }),
      client.invalidateQueries({ queryKey: adminKeys.team(teamId) }),
    ]),
  })
}

export function useRejectAdminTeam(teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => adminApi.rejectTeam(teamId, reason),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'teams'] }),
      client.invalidateQueries({ queryKey: adminKeys.team(teamId) }),
    ]),
  })
}

export function useUnverifyAdminTeam(teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => adminApi.unverifyTeam(teamId, reason),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'teams'] }),
      client.invalidateQueries({ queryKey: adminKeys.team(teamId) }),
    ]),
  })
}

export function useAdminCompetitions(filters: CompetitionFilters = {}) {
  return useQuery({ queryKey: adminKeys.competitions(filters), queryFn: () => adminApi.competitions(filters) })
}

export function useCreateCompetition() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (payload: CompetitionPayload) => adminApi.createCompetition(payload), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'competitions'] }) })
}

export function useUpdateCompetition() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: CompetitionPayload }) => adminApi.updateCompetition(id, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'competitions'] }) })
}

export function useAdminStages(competitionId?: string) {
  return useQuery({ queryKey: adminKeys.stages(competitionId), queryFn: () => adminApi.stages(competitionId) })
}

export function useAdminStageScores(stageId?: string) {
  return useQuery({
    queryKey: [...adminKeys.all, 'stage-scores', stageId] as const,
    queryFn: () => adminApi.stageScores(stageId as string),
    enabled: Boolean(stageId),
  })
}

export function useCreateStage() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (payload: StagePayload) => adminApi.createStage(payload), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'stages'] }) })
}

export function useUpdateStage() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: UpdateStagePayload }) => adminApi.updateStage(id, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'stages'] }) })
}

export function useDeleteStage() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => adminApi.deleteStage(id), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'stages'] }) })
}

export function useDeleteCompetition() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => adminApi.deleteCompetition(id), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'competitions'] }) })
}

export function useAdminBatches(competitionId?: string) {
  return useQuery({ queryKey: adminKeys.batches(competitionId), queryFn: () => adminApi.batches(competitionId) })
}

export function useCreateBatch() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (payload: BatchPayload) => adminApi.createBatch(payload), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'batches'] }) })
}

export function useUpdateBatch() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Omit<BatchPayload, 'competition_id'> }) => adminApi.updateBatch(id, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'batches'] }) })
}

export function useDeleteBatch() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => adminApi.deleteBatch(id), onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'batches'] }) })
}

export function useAdminPayments(filters: AdminPaymentFilters) {
  return useQuery({ queryKey: adminKeys.payments(filters), queryFn: () => adminApi.payments(filters) })
}

export function useAdminPayment(registrationId: string) {
  return useQuery({ queryKey: adminKeys.payment(registrationId), queryFn: () => adminApi.payment(registrationId), enabled: Boolean(registrationId) })
}

export function useVerifyAdminPayment(registrationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.verifyPayment(registrationId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'payments'] }),
      client.invalidateQueries({ queryKey: adminKeys.payment(registrationId) }),
    ]),
  })
}

export function useReviseAdminPayment(registrationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => adminApi.revisePayment(registrationId, reason),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'payments'] }),
      client.invalidateQueries({ queryKey: adminKeys.payment(registrationId) }),
    ]),
  })
}

export function useRejectAdminPayment(registrationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => adminApi.rejectPayment(registrationId, reason),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'payments'] }),
      client.invalidateQueries({ queryKey: adminKeys.payment(registrationId) }),
    ]),
  })
}

export function useUnverifyAdminPayment(registrationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => adminApi.unverifyPayment(registrationId, reason),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'payments'] }),
      client.invalidateQueries({ queryKey: adminKeys.payment(registrationId) }),
    ]),
  })
}

export function useUpdateAdminTeam(teamId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: AdminTeamUpdatePayload) => adminApi.updateTeamRegistration(teamId, payload),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: [...adminKeys.all, 'teams'] }),
      client.invalidateQueries({ queryKey: adminKeys.team(teamId) }),
    ]),
  })
}

export function useAdminOperations(filters: AdminOperationFilters) {
  return useQuery({ queryKey: adminKeys.operations(filters), queryFn: () => adminApi.operations(filters) })
}

export function useAdminOperation(operationId: string) {
  return useQuery({ queryKey: adminKeys.operation(operationId), queryFn: () => adminApi.operation(operationId), enabled: Boolean(operationId) })
}

export function useCreateAdminOperation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAdminOperationPayload) => adminApi.createOperation(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, 'operations'] }),
  })
}

export function useRetryAdminOperationSpreadsheet(operationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.retryOperationSpreadsheet(operationId),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.operation(operationId) }),
  })
}
