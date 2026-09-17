import { zodResolver } from '@hookform/resolvers/zod'
import {
  BookOpen,
  Building2,
  IdCard,
  Mail,
  User,
} from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FileUpload, type UploadedFile } from '@/components/shared/FileUpload'
import {
  createMemberSchema,
  type MemberFormData,
} from '@/features/registrations/schemas/createTeamMember'
import type {
  MemberFormValues,
  MemberRole,
  ParticipantCategory,
} from '@/features/registrations/types/registrationTypes'

interface FormMemberProps {
  memberId: number
  role: MemberRole
  sortOrder: number
  participantCategory: ParticipantCategory
  defaultValues?: MemberFormValues
  onFocus?: () => void
  onSave?: (data: MemberFormValues) => void
  onValidationChange?: (isValid: boolean) => void
  showSubmit?: boolean
}

const emptyValues: MemberFormData = {
  name: '',
  email: '',
  major: '',
  faculty: '',
  student_id: '',
  photo_file_id: null,
}

const inputClassName =
  'h-[46px] w-full rounded-xl pl-10 pr-3 text-sm sm:h-[50px] sm:pl-11 sm:pr-4 sm:text-base md:h-[54px] md:pl-12'

const iconClassName =
  'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-4 sm:h-5 sm:w-5'

const FormMember = ({
  memberId,
  role,
  sortOrder,
  participantCategory,
  defaultValues,
  onFocus,
  onSave,
  onValidationChange,
  showSubmit = true,
}: FormMemberProps) => {
  const [hasSaved, setHasSaved] = useState(Boolean(defaultValues))
  const [photo, setPhoto] = useState<UploadedFile>(null)

  const form = useForm<MemberFormData>({
    mode: 'onChange',
    resolver: zodResolver(createMemberSchema(participantCategory)),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    form.reset(
      defaultValues
        ? {
            name: defaultValues.name,
            email: defaultValues.email,
            major: defaultValues.major ?? '',
            faculty: defaultValues.faculty ?? '',
            student_id: defaultValues.student_id,
            photo_file_id: defaultValues.photo_file_id,
          }
        : emptyValues,
    )

    setHasSaved(Boolean(defaultValues))
  }, [defaultValues, form])

  useEffect(() => {
    onValidationChange?.(
      (form.formState.isValid || Boolean(defaultValues)) && hasSaved,
    )
  }, [
    defaultValues,
    form.formState.isValid,
    hasSaved,
    onValidationChange,
  ])

  const onSubmit = (data: MemberFormData) => {
    onSave?.({
      id: defaultValues?.id,
      ...data,
      major: data.major || null,
      faculty: data.faculty || null,
      role,
      sort_order: sortOrder,
    })

    setHasSaved(true)
  }

  const isUniversity =
    participantCategory === 'UNIVERSITY_STUDENT'

  const fields = [
    {
      name: 'name' as const,
      label: 'Nama Lengkap',
      placeholder: 'Masukkan nama lengkap',
      type: 'text',
      Icon: User,
    },
    {
      name: 'email' as const,
      label: isUniversity ? 'Email Mahasiswa' : 'Email Siswa',
      placeholder: isUniversity
        ? 'Masukkan email mahasiswa'
        : 'Masukkan email siswa',
      type: 'email',
      Icon: Mail,
    },
    ...(isUniversity
      ? [
          {
            name: 'major' as const,
            label: 'Jurusan',
            placeholder: 'Masukkan jurusan',
            type: 'text',
            Icon: BookOpen,
          },
          {
            name: 'faculty' as const,
            label: 'Fakultas',
            placeholder: 'Masukkan fakultas',
            type: 'text',
            Icon: Building2,
          },
        ]
      : []),
    {
      name: 'student_id' as const,
      label: isUniversity ? 'NIM' : 'NISN',
      placeholder: isUniversity
        ? 'Masukkan NIM mahasiswa'
        : 'Masukkan NISN siswa',
      type: 'text',
      Icon: IdCard,
    },
  ]

  return (
    <form
      id={`member-form-${memberId}`}
      onSubmit={form.handleSubmit(onSubmit)}
      className="relative z-10 w-full space-y-4 sm:space-y-5"
      onFocus={() => {
        setHasSaved(false)
        onFocus?.()
      }}
    >
      <FieldGroup className="gap-3.5 sm:gap-4">
        {fields.map(
          ({ name, label, placeholder, type, Icon }) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  className="min-w-0 w-full"
                >
                  <FieldLabel className="mb-1.5 text-sm font-medium sm:text-base md:text-lg">
                    {label}
                  </FieldLabel>

                  <div className="relative w-full">
                    <Icon className={iconClassName} />

                    <Input
                      {...field}
                      type={type}
                      placeholder={placeholder}
                      autoComplete="off"
                      aria-invalid={fieldState.invalid}
                      className={inputClassName}
                    />
                  </div>

                  {fieldState.invalid && (
                    <FieldError
                      errors={[fieldState.error]}
                      className="mt-1 text-xs sm:text-sm"
                    />
                  )}
                </Field>
              )}
            />
          ),
        )}

        <Controller
          name="photo_file_id"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              data-invalid={fieldState.invalid}
              className="min-w-0 w-full"
            >
              <FieldLabel className="mb-1.5 text-sm font-medium sm:text-base md:text-lg">
                Foto Peserta
              </FieldLabel>

              <div className="w-full overflow-hidden rounded-xl">
                <FileUpload
                  value={photo}
                  onChange={(value) => {
                    setPhoto(value)
                    field.onChange(value?.id ?? null)
                    setHasSaved(false)
                  }}
                  folder="/member-photos"
                  purpose="MEMBER_PHOTO"
                  label="Upload Foto Peserta"
                  subLabel="JPG, PNG, atau WebP maksimal 5 MB"
                  accept="image/png,image/jpeg,image/webp"
                  maxSizeMB={5}
                />
              </div>

              {fieldState.invalid && (
                <FieldError
                  errors={[fieldState.error]}
                  className="mt-1 text-xs sm:text-sm"
                />
              )}
            </Field>
          )}
        />
      </FieldGroup>

      {showSubmit && (
        <div className="mt-5 flex w-full justify-center sm:mt-6">
          <Button
            type="submit"
            form={`member-form-${memberId}`}
            className="h-11 w-full rounded-xl px-6 text-sm font-semibold sm:h-12 sm:w-auto sm:min-w-32 sm:px-8 sm:text-base"
            disabled={
              !form.formState.isValid ||
              form.formState.isSubmitting ||
              hasSaved
            }
          >
            {hasSaved ? 'Tersimpan' : 'Simpan'}
          </Button>
        </div>
      )}
    </form>
  )
}

export default FormMember