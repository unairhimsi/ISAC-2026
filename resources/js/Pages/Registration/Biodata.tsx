import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import RegistrationLayout from '@/features/registrations/components/RegistrationLayout'
import FormMember from '@/features/registrations/components/FormMember'
import { useFinalizeMembers, useMembers } from '@/features/registrations/hooks/useRegistration'
import type { CompetitionType, MemberFormValues, MemberRole } from '@/features/registrations/types/registrationTypes'

interface MemberSlot {
  key: number
  role: MemberRole
  label: string
}

const buildLabel = (competitionType: CompetitionType, index: number): string => {
  if (competitionType === 'OLIMPIADE') return 'Peserta Olimpiade'
  if (index === 0) return 'Ketua Tim'
  return `Anggota ${index}`
}

const createSlots = (count: number, competitionType: CompetitionType): MemberSlot[] =>
  Array.from({ length: count }, (_, index) => ({
    key: index + 1,
    role: index === 0 ? 'LEADER' : 'MEMBER',
    label: buildLabel(competitionType, index),
  }))

const Biodata = () => {
  const membersQuery = useMembers()
  const finalizeMembers = useFinalizeMembers()
  const pageData = membersQuery.data?.data
  const [members, setMembers] = useState<MemberSlot[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [savedData, setSavedData] = useState<Record<number, MemberFormValues>>({})
  const [validState, setValidState] = useState<Record<number, boolean>>({})
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const minMembers = pageData?.minMembers ?? 1
  const maxMembers = pageData?.maxMembers ?? 3
  const isOlympiad = pageData?.competitionType === 'OLIMPIADE'

  useEffect(() => {
    if (!pageData) return
    const existingCount = pageData.members.length
    const initialCount = Math.max(minMembers, Math.min(maxMembers, existingCount || minMembers))
    const slots = createSlots(initialCount, pageData.competitionType)
    const saved = Object.fromEntries(
      pageData.members.map((member, index) => [index + 1, {
        id: member.id, name: member.name, role: member.role, email: member.email,
        major: member.major, faculty: member.faculty, student_id: member.studentId,
        photo_file_id: member.photoFileId, sort_order: member.sortOrder,
      }])
    )
    const valid = Object.fromEntries(slots.map((slot) => [slot.key, Boolean(saved[slot.key])]))
    setMembers(slots)
    setSavedData(saved)
    setValidState(valid)
  }, [pageData, minMembers, maxMembers])

  const handleSave = (slot: MemberSlot) => (data: MemberFormValues) => {
    setSavedData((current) => ({ ...current, [slot.key]: data }))
    setValidState((current) => ({ ...current, [slot.key]: true }))
    toast.success(`${slot.label} berhasil disimpan`)
    const index = members.findIndex((member) => member.key === slot.key)
    if (index < members.length - 1) setActiveIndex(index + 1)
    else submitButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const allMembersValid = members.length > 0 && members.every((member) => validState[member.key] && savedData[member.key])

  const addMember = useCallback(() => {
    if (!pageData) return
    if (members.length >= maxMembers) return
    setMembers((current) => {
      const nextIndex = current.length
      const nextKey = nextIndex + 1
      return [...current, {
        key: nextKey,
        role: 'MEMBER',
        label: buildLabel(pageData.competitionType, nextIndex),
      }]
    })
    setActiveIndex(members.length)
  }, [members.length, maxMembers, pageData])

  const removeMember = useCallback((slot: MemberSlot) => {
    if (!pageData) return
    if (members.length <= minMembers) return
    if (slot.role === 'LEADER' && !isOlympiad) {
      toast.error('Ketua tim tidak dapat dihapus. Pilih ketua baru terlebih dahulu.')
      return
    }
    setMembers((current) => current.filter((member) => member.key !== slot.key))
    setSavedData((current) => {
      const { [slot.key]: _, ...rest } = current
      return rest
    })
    setValidState((current) => {
      const { [slot.key]: _, ...rest } = current
      return rest
    })
    setActiveIndex((current) => Math.max(0, current - 1))
  }, [members.length, minMembers, pageData, isOlympiad])

  const handleComplete = useCallback(async () => {
    if (!allMembersValid) {
      toast.error('Masih ada data anggota yang belum disimpan atau belum valid')
      return
    }

    try {
      const response = await finalizeMembers.mutateAsync({
        members: members.map((member, index) => ({
          ...savedData[member.key],
          role: index === 0 ? 'LEADER' : 'MEMBER',
          sort_order: index + 1,
        })),
      })
      toast.success(response.message)
      router.visit(response.data.redirectTo, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan biodata anggota')
    }
  }, [allMembersValid, finalizeMembers, members, savedData])

  const getLayoutTransform = (index: number) => {
    const offset = (index - activeIndex) * 110
    const scale = index === activeIndex ? 1.05 : 0.9
    const translateY = index === activeIndex ? -30 : 30
    return {
      transform: `translateX(${offset}%) translateY(${translateY}px) scale(${scale})`,
      zIndex: index === activeIndex ? 10 : 1,
      opacity: Math.abs(index - activeIndex) > 1 ? 0 : 1,
    }
  }

  const memberCounter = useMemo(() => `${members.length}/${maxMembers} peserta`, [members.length, maxMembers])

  if (membersQuery.isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Memuat biodata peserta...</div>
  }

  if (membersQuery.error || !pageData) {
    return <div className="py-12 text-center text-red-400">{membersQuery.error?.message ?? 'Data registrasi tidak tersedia.'}</div>
  }

  const canAdd = members.length < maxMembers && !isOlympiad
  const canRemove = (slot: MemberSlot) => members.length > minMembers && !(slot.role === 'LEADER' && !isOlympiad)

  console.log(canAdd)

  return (
    <div className="w-full max-w-7xl mx-auto px-4 text-center text-primary-foreground">
      <div className="hidden md:flex items-center justify-center gap-4">
        <button
          onClick={() => setActiveIndex((activeIndex - 1 + members.length) % members.length)}
          disabled={members.length <= 1}
          className="relative z-50 p-3 rounded-full bg-card/80 backdrop-blur-md border-2 border-border text-white hover:bg-card hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/20 hover:scale-110"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className={`relative flex justify-center items-center gap-6 ${pageData.competitionType === 'BUSINESS_IT_CASE'?'min-h-300':'min-h-225'} perspective-[1000px] w-full max-w-4xl`}>
          {members.map((member, index) => (
            <div
              key={member.key}
              className="absolute w-full max-w-lg transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] will-change-transform"
              style={getLayoutTransform(index)}
            >
              <div className="relative bg-background/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-2xl shadow-secondary/10">
                <span aria-hidden="true" className="header-border-track absolute inset-0 rounded-2xl pointer-events-none" />
                <span aria-hidden="true" className="header-border-spin absolute inset-0 rounded-2xl pointer-events-none" />
                <div className="mb-4 flex items-center justify-between gap-3 relative z-10">
                  <h3 className="text-xl font-semibold">{member.label}</h3>
                  {!isOlympiad && (
                    <button
                      type="button"
                      onClick={() => removeMember(member)}
                      disabled={!canRemove(member)}
                      aria-label={`Hapus ${member.label}`}
                      className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive transition-all hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                      Hapus
                    </button>
                  )}
                </div>
                <FormMember
                  memberId={member.key}
                  role={member.role}
                  sortOrder={index}
                  participantCategory={pageData.participantCategory}
                  defaultValues={savedData[member.key]}
                  onFocus={() => setActiveIndex(index)}
                  onSave={handleSave(member)}
                  onValidationChange={(valid) => setValidState((current) => ({ ...current, [member.key]: valid }))}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setActiveIndex((activeIndex + 1) % members.length)}
          disabled={members.length <= 1}
          className="relative z-50 p-3 rounded-full bg-card/80 backdrop-blur-md border-2 border-border text-white hover:bg-card hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/20 hover:scale-110"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <div className="md:hidden space-y-6">
        {members.map((member, index) => (
          <div key={member.key} className="relative z-10 w-full rounded-xl border-0 bg-background/20 backdrop-blur-sm shadow-2xl">
            <span aria-hidden="true" className="auth-border-ribbon" />
            <span aria-hidden="true" className="auth-border-diamond" />
            <div className="mb-4 flex items-center justify-between gap-3 relative z-10">
              <h3 className="text-lg font-semibold">{member.label}</h3>
              {!isOlympiad && (
                <button
                  type="button"
                  onClick={() => removeMember(member)}
                  disabled={!canRemove(member)}
                  aria-label={`Hapus ${member.label}`}
                  className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive transition-all hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                  Hapus
                </button>
              )}
            </div>
            <FormMember
              memberId={member.key}
              role={member.role}
              sortOrder={index}
              participantCategory={pageData.participantCategory}
              defaultValues={savedData[member.key]}
              onSave={handleSave(member)}
              onValidationChange={(valid) => setValidState((current) => ({ ...current, [member.key]: valid }))}
            />
          </div>
        ))}
      </div>
      <div className="relative z-20  pb-8">
        <button
          ref={submitButtonRef}
          onClick={handleComplete}
          disabled={finalizeMembers.isPending}
          className="px-10 py-4 rounded-xl cursor-pointer bg-primary text-white font-bold text-lg hover:bg-primary/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl hover:scale-105"
        >
          {finalizeMembers.isPending ? (
            <span className="flex items-center gap-3"><Loader2 className="w-6 h-6 animate-spin" />Menyimpan...</span>
          ) : 'Simpan Semua Peserta'}
        </button>
        <div className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4 mt-8">
            <span className="rounded-full border border-border bg-card/60 px-4 py-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {memberCounter}
            </span>
            {!isOlympiad && (
              <button
                type="button"
                onClick={addMember}
                // disabled={!canAdd}
                className="inline-flex items-center cursor-pointer gap-2 rounded-full border border-secondary/40 bg-secondary/15 px-4 py-1.5 disabled:bg-black/20 text-sm font-medium text-secondary transition-all hover:border-secondary hover:bg-secondary/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-4" />
                Tambah Peserta
              </button>
            )}
          </div>
      </div>
    </div>
  )
}

Biodata.layout = (page: React.ReactNode) => (
  <RegistrationLayout title="Biodata Peserta — Pendaftaran ISAC 2026" description="Lengkapi biodata ketua & anggota tim ISAC 2026 (NISN/NIM, jurusan, kontak darurat) — Olimpiade butuh 1 orang, Business Plan/IT Case 1–3 orang.">
    {page}
  </RegistrationLayout>
)

export default Biodata
