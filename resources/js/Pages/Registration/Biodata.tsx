import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import RegistrationLayout from '@/features/registrations/components/RegistrationLayout'
import FormMember from '@/features/registrations/components/FormMember'
import { useFinalizeMembers, useMembers } from '@/features/registrations/hooks/useRegistration'
import type {
  CompetitionType,
  MemberFormValues,
  MemberRole,
} from '@/features/registrations/types/registrationTypes'

interface MemberSlot {
  key: number
  role: MemberRole
  label: string
}

const buildLabel = (
  competitionType: CompetitionType,
  index: number,
): string => {
  if (competitionType === 'OLIMPIADE') return 'Peserta Olimpiade'
  if (index === 0) return 'Ketua Tim'
  return `Anggota ${index}`
}

const createSlots = (
  count: number,
  competitionType: CompetitionType,
): MemberSlot[] =>
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

    const initialCount = Math.max(
      minMembers,
      Math.min(
        maxMembers,
        existingCount || minMembers,
      ),
    )

    const slots = createSlots(
      initialCount,
      pageData.competitionType,
    )

    const saved = Object.fromEntries(
      pageData.members.map((member, index) => [
        index + 1,
        {
          id: member.id,
          name: member.name,
          role: member.role,
          email: member.email,
          major: member.major,
          faculty: member.faculty,
          student_id: member.studentId,
          photo_file_id: member.photoFileId,
          sort_order: member.sortOrder,
        },
      ]),
    )

    const valid = Object.fromEntries(
      slots.map((slot) => [
        slot.key,
        Boolean(saved[slot.key]),
      ]),
    )

    setMembers(slots)
    setSavedData(saved)
    setValidState(valid)
    setActiveIndex(0)
  }, [
    pageData,
    minMembers,
    maxMembers,
  ])

  const handleSave = useCallback(
    (slot: MemberSlot) => (data: MemberFormValues) => {
      setSavedData((current) => ({
        ...current,
        [slot.key]: data,
      }))

      setValidState((current) => ({
        ...current,
        [slot.key]: true,
      }))

      toast.success(`${slot.label} berhasil disimpan`)

      const index = members.findIndex(
        (member) => member.key === slot.key,
      )

      if (index < members.length - 1) {
        setActiveIndex(index + 1)
        return
      }

      submitButtonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    },
    [members],
  )

  const allMembersValid =
    members.length > 0 &&
    members.every(
      (member) =>
        validState[member.key] &&
        savedData[member.key],
    )

  const addMember = useCallback(() => {
    if (!pageData) return
    if (members.length >= maxMembers) return

    const nextKey =
      Math.max(
        0,
        ...members.map((member) => member.key),
      ) + 1

    const nextIndex = members.length

    setMembers((current) => [
      ...current,
      {
        key: nextKey,
        role: 'MEMBER',
        label: buildLabel(
          pageData.competitionType,
          nextIndex,
        ),
      },
    ])

    setActiveIndex(members.length)
  }, [
    members,
    maxMembers,
    pageData,
  ])

  const removeMember = useCallback(
    (slot: MemberSlot) => {
      if (!pageData) return
      if (members.length <= minMembers) return

      if (slot.role === 'LEADER' && !isOlympiad) {
        toast.error(
          'Ketua tim tidak dapat dihapus. Pilih ketua baru terlebih dahulu.',
        )
        return
      }

      const removedIndex = members.findIndex(
        (member) => member.key === slot.key,
      )

      setMembers((current) =>
        current
          .filter(
            (member) => member.key !== slot.key,
          )
          .map((member, index) => ({
            ...member,
            label: buildLabel(
              pageData.competitionType,
              index,
            ),
          })),
      )

      setSavedData((current) => {
        const { [slot.key]: _, ...rest } = current
        return rest
      })

      setValidState((current) => {
        const { [slot.key]: _, ...rest } = current
        return rest
      })

      setActiveIndex((current) => {
        if (removedIndex === -1) return current

        const nextLength = members.length - 1

        if (nextLength <= 0) return 0

        if (removedIndex < current) {
          return current - 1
        }

        return Math.min(
          current,
          nextLength - 1,
        )
      })
    },
    [
      members,
      minMembers,
      pageData,
      isOlympiad,
    ],
  )

  const handleComplete = useCallback(
    async () => {
      if (!allMembersValid) {
        toast.error(
          'Masih ada data anggota yang belum disimpan atau belum valid',
        )
        return
      }

      try {
        const response =
          await finalizeMembers.mutateAsync({
            members: members.map(
              (member, index) => ({
                ...savedData[member.key],
                role:
                  index === 0
                    ? 'LEADER'
                    : 'MEMBER',
                sort_order: index + 1,
              }),
            ),
          })

        toast.success(response.message)

        router.visit(
          response.data.redirectTo,
          {
            replace: true,
          },
        )
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan biodata anggota',
        )
      }
    },
    [
      allMembersValid,
      finalizeMembers,
      members,
      savedData,
    ],
  )

  const getLayoutTransform = (
    index: number,
  ): React.CSSProperties => {
    const rawDistance =
      index - activeIndex

    const memberCount = members.length

    let distance = rawDistance

    if (memberCount > 1) {
      const half = memberCount / 2

      if (distance > half) {
        distance -= memberCount
      }

      if (distance < -half) {
        distance += memberCount
      }
    }

    const isActive = distance === 0
    const isVisible = Math.abs(distance) <= 1

    const translateY = isActive
      ? -24
      : 24

    const scale = isActive
      ? 1
      : 0.94

    return {
      transform: `translateX(calc(${distance} * 100%)) translateY(${translateY}px) scale(${scale})`,
      opacity: isVisible ? 1 : 0,
      zIndex: isActive ? 30 : 10,
      pointerEvents: isActive
        ? 'auto'
        : 'none',
    }
  }

  const memberCounter = useMemo(
    () =>
      `${members.length}/${maxMembers} peserta`,
    [members.length, maxMembers],
  )

  if (membersQuery.isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Memuat biodata peserta...
      </div>
    )
  }

  if (membersQuery.error || !pageData) {
    return (
      <div className="py-12 text-center text-red-400">
        {membersQuery.error?.message ??
          'Data registrasi tidak tersedia.'}
      </div>
    )
  }

  const canAdd =
    members.length < maxMembers &&
    !isOlympiad

  const canRemove = (
    slot: MemberSlot,
  ) =>
    members.length > minMembers &&
    !(
      slot.role === 'LEADER' &&
      !isOlympiad
    )

  const goPrevious = () => {
    if (members.length <= 1) return

    setActiveIndex(
      (current) =>
        (current -
          1 +
          members.length) %
        members.length,
    )
  }

  const goNext = () => {
    if (members.length <= 1) return

    setActiveIndex(
      (current) =>
        (current + 1) %
        members.length,
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 text-center text-primary-foreground sm:px-4">
      <div className="relative w-full mt-12 md:mt-16">
        <div className="relative overflow-x-clip px-8 sm:px-10 md:px-12">
          <div className="grid w-full items-start">
            {members.map((member, index) => (
              <div
                key={member.key}
                className="
                  col-start-1
                  row-start-1
                  mx-auto
                  w-full
                  max-w-lg
                  transition-[transform,opacity]
                  duration-700
                  ease-[cubic-bezier(0.25,0.1,0.25,1)]
                  will-change-transform
                "
                style={getLayoutTransform(
                  index,
                )}
              >
                <div
                  className="
                    relative
                    w-full
                    rounded-2xl
                    border
                    border-border/50
                    bg-background/90
                    p-4
                    shadow-2xl
                    shadow-secondary/10
                    backdrop-blur-md
                    sm:p-5
                    md:p-6
                  "
                >
                  <span
                    aria-hidden="true"
                    className="
                      pointer-events-none
                      absolute
                      inset-0
                      rounded-2xl
                    "
                  />

                  <span
                    aria-hidden="true"
                    className="
                      header-border-track
                      pointer-events-none
                      absolute
                      inset-0
                      rounded-2xl
                    "
                  />

                  <span
                    aria-hidden="true"
                    className="
                      header-border-spin
                      pointer-events-none
                      absolute
                      inset-0
                      rounded-2xl
                    "
                  />

                  <div className="relative z-10 mb-4 flex min-w-0 items-center justify-between gap-2 sm:mb-5 sm:gap-3">
                    <h3 className="min-w-0 flex-1 truncate text-left text-lg font-semibold sm:text-xl">
                      {member.label}
                    </h3>

                    {!isOlympiad && (
                      <button
                        type="button"
                        onClick={() =>
                          removeMember(
                            member,
                          )
                        }
                        disabled={
                          !canRemove(
                            member,
                          )
                        }
                        aria-label={`Hapus ${member.label}`}
                        className="
                          inline-flex
                          shrink-0
                          items-center
                          justify-center
                          gap-1
                          rounded-full
                          border
                          border-destructive/40
                          px-2.5
                          py-1.5
                          text-[11px]
                          font-medium
                          text-destructive
                          transition-all
                          hover:bg-destructive/10
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                          sm:px-3
                          sm:py-1
                          sm:text-xs
                        "
                      >
                        <Trash2 className="size-3.5" />

                        <span className="hidden sm:inline">
                          Hapus
                        </span>
                      </button>
                    )}
                  </div>

                  <FormMember
                    memberId={
                      member.key
                    }
                    role={member.role}
                    sortOrder={
                      index + 1
                    }
                    participantCategory={
                      pageData.participantCategory
                    }
                    defaultValues={
                      savedData[
                        member.key
                      ]
                    }
                    onFocus={() =>
                      setActiveIndex(
                        index,
                      )
                    }
                    onSave={handleSave(
                      member,
                    )}
                    onValidationChange={(
                      valid,
                    ) =>
                      setValidState(
                        (current) => ({
                          ...current,
                          [member.key]:
                            valid,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={goPrevious}
            disabled={members.length <= 1}
            aria-label="Peserta sebelumnya"
            className="
              absolute
              left-0
              top-1/2
              z-50
              flex
              size-8
              -translate-y-1/2
              items-center
              justify-center
              rounded-full
              border-2
              border-border
              bg-card/90
              text-white
              shadow-lg
              backdrop-blur-md
              transition-all
              hover:scale-110
              hover:border-primary/50
              hover:bg-card
              hover:shadow-primary/20
              disabled:cursor-not-allowed
              disabled:opacity-30
              sm:size-10
            "
          >
            <ChevronLeft className="size-4 sm:size-6" />
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={members.length <= 1}
            aria-label="Peserta berikutnya"
            className="
              absolute
              right-0
              top-1/2
              z-50
              flex
              size-8
              -translate-y-1/2
              items-center
              justify-center
              rounded-full
              border-2
              border-border
              bg-card/90
              text-white
              shadow-lg
              backdrop-blur-md
              transition-all
              hover:scale-110
              hover:border-primary/50
              hover:bg-card
              hover:shadow-primary/20
              disabled:cursor-not-allowed
              disabled:opacity-30
              sm:size-10
            "
          >
            <ChevronRight className="size-4 sm:size-6" />
          </button>
        </div>
      </div>

      <div className="relative z-40 mt-6 pb-8 sm:mt-8">
        <button
          ref={submitButtonRef}
          type="button"
          onClick={handleComplete}
          disabled={
            finalizeMembers.isPending ||
            !allMembersValid
          }
          className="
            inline-flex
            min-h-12
            w-full
            items-center
            justify-center
            rounded-xl
            bg-primary
            px-6
            py-3
            text-base
            font-bold
            text-white
            shadow-lg
            transition-all
            hover:scale-[1.02]
            hover:bg-primary/80
            hover:shadow-xl
            disabled:cursor-not-allowed
            disabled:opacity-40
            disabled:hover:scale-100
            sm:w-auto
            sm:min-w-56
            sm:px-10
            sm:text-lg
          "
        >
          {finalizeMembers.isPending ? (
            <span className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin sm:size-6" />
              Menyimpan...
            </span>
          ) : (
            'Simpan Semua Peserta'
          )}
        </button>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <span className="rounded-full border border-border bg-card/60 px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
            {memberCounter}
          </span>

          {!isOlympiad && (
            <button
              type="button"
              onClick={addMember}
              disabled={!canAdd}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-full
                border
                border-secondary/40
                bg-secondary/15
                px-4
                py-2
                text-xs
                font-medium
                text-secondary
                transition-all
                hover:border-secondary
                hover:bg-secondary/25
                disabled:cursor-not-allowed
                disabled:bg-black/20
                disabled:opacity-40
                sm:text-sm
              "
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

Biodata.layout = (
  page: React.ReactNode,
) => (
  <RegistrationLayout
    title="Biodata Peserta — Pendaftaran ISAC 2026"
    description="Lengkapi biodata ketua & anggota tim ISAC 2026 (NISN/NIM, jurusan, kontak darurat) — Olimpiade butuh 1 orang, Business Plan/IT Case 1–3 orang."
  >
    {page}
  </RegistrationLayout>
)

export default Biodata