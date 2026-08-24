import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FileUpload } from '@/components/shared/FileUpload'
import { uploadPaymentSchema, type UploadPaymentInput } from '../schemas/uploadPayment'
import type { BankAccount, ExternalFile, PaymentFormValues, PaymentQuoteData } from '../types/registrationTypes'
import { usePaymentQuote } from '../hooks/useRegistration'
import { ApiClientError } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

type Props = {
  bankAccounts: BankAccount[]
  originalAmount: number
  amount: number
  discountPercent: number
  discountAmount: number
  promoApplied: boolean
  promoCode: string | null
  instructions: string | null
  existingProof: ExternalFile | null
  isSubmitting: boolean
  onSubmit: (values: PaymentFormValues) => Promise<void>
}

const formatAccountNumber = (value: string) => value.replace(/(\d{4})(?=\d)/g, '$1 ')

const FormPayment = ({
  bankAccounts,
  originalAmount,
  amount,
  discountPercent,
  discountAmount,
  promoApplied,
  promoCode,
  instructions,
  existingProof,
  isSubmitting,
  onSubmit,
}: Props) => {
  const quotePayment = usePaymentQuote()
  const quoteRequestId = useRef(0)
  const [copiedBank, setCopiedBank] = useState<string | null>(null)
  const [pricing, setPricing] = useState<PaymentQuoteData>({
    originalAmount,
    amount,
    discountPercent,
    discountAmount,
    promoApplied,
    promoCode,
  })
  const form = useForm<UploadPaymentInput>({
    mode: 'onChange',
    resolver: zodResolver(uploadPaymentSchema),
    defaultValues: {
      payment_method: 'BANK_TRANSFER',
      promo_code: promoCode ?? '',
      paymentProof: existingProof,
    },
  })
  const currentPromoCode = form.watch('promo_code')

  const handleCopyAccount = async (bank: string, accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = accountNumber
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedBank(bank)
    window.setTimeout(() => setCopiedBank((current) => (current === bank ? null : current)), 2000)
  }

  useEffect(() => {
    const normalizedPromoCode = currentPromoCode.trim().toUpperCase()
    const requestId = ++quoteRequestId.current

    if (normalizedPromoCode === '') {
      form.clearErrors('promo_code')
      setPricing({
        originalAmount,
        amount: originalAmount,
        discountPercent: 0,
        discountAmount: 0,
        promoApplied: false,
        promoCode: null,
      })
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await quotePayment.mutateAsync(normalizedPromoCode)
        if (quoteRequestId.current !== requestId) return
        setPricing(response.data)
        form.clearErrors('promo_code')
      } catch (error) {
        if (quoteRequestId.current !== requestId) return
        const message = error instanceof ApiClientError
          ? error.fields.promo_code?.[0] ?? error.message
          : 'Kode promo gagal diperiksa.'
        setPricing({
          originalAmount,
          amount: originalAmount,
          discountPercent: 0,
          discountAmount: 0,
          promoApplied: false,
          promoCode: null,
        })
        form.setError('promo_code', { type: 'server', message })
      }
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [currentPromoCode, originalAmount])

  const handleSubmit = async (values: UploadPaymentInput) => {
    if (!values.paymentProof) return
    const normalizedPromoCode = values.promo_code.trim().toUpperCase()

    if (normalizedPromoCode !== '') {
      try {
        const response = await quotePayment.mutateAsync(normalizedPromoCode)
        setPricing(response.data)
        form.clearErrors('promo_code')
      } catch (error) {
        const message = error instanceof ApiClientError
          ? error.fields.promo_code?.[0] ?? error.message
          : 'Kode promo gagal diperiksa.'
        form.setError('promo_code', { type: 'server', message })
        return
      }
    }

    await onSubmit({
      payment_method: values.payment_method,
      promo_code: normalizedPromoCode || undefined,
      payment_proof_file_id: values.paymentProof.id,
    })
  }

  return (
    <form id="form-payment" onSubmit={form.handleSubmit(handleSubmit)} className="relative isolate w-full overflow-hidden rounded-2xl">
      <span aria-hidden="true" className="header-border-track" />
      <span aria-hidden="true" className="header-border-spin" />

      <div className="relative z-10 rounded-[inherit] bg-background/60 px-6 py-8 backdrop-blur-sm">
        <div className="flex md:flex-row flex-col justify-center md:items-center gap-8 md:gap-10">
          <div className="flex justify-center w-full">
            <div className="w-full max-w-[260px] space-y-3">
              <p className="text-center text-sm font-semibold uppercase tracking-wide text-foreground">Rekening Tujuan</p>
              {bankAccounts.map((account) => (
                <div key={account.bank} className="rounded-2xl border border-primary bg-background p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-foreground">{account.bank}</p>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(account.bank, account.accountNumber)}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-input px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Salin nomor rekening ${account.bank}`}
                    >
                      {copiedBank === account.bank ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedBank === account.bank ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>
                  <p className="mt-2 text-lg font-bold tracking-wide text-foreground">{formatAccountNumber(account.accountNumber)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">a.n. {account.accountName}</p>
                </div>
              ))}
            </div>
          </div>

          <FieldGroup className="gap-5">
            <div className="text-center">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground">Total Biaya Pendaftaran</p>
              {pricing.promoApplied && (
                <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="text-muted-foreground line-through">{formatCurrency(pricing.originalAmount)}</span>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-400">
                    Diskon {pricing.discountPercent}% · Hemat {formatCurrency(pricing.discountAmount)}
                  </span>
                </div>
              )}
              <div className="inline-block rounded-full bg-primary px-8 py-3">
                <span className="text-2xl font-bold text-primary-foreground">{formatCurrency(pricing.amount)}</span>
              </div>
              {instructions && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{instructions}</p>}
            </div>

            <Controller
              name="promo_code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="text-sm font-semibold uppercase tracking-wide text-foreground">Kode Promo (Opsional)</FieldLabel>
                  <Input
                    {...field}
                    onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                    placeholder="Masukkan kode promo"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    className="rounded-full bg-background py-5 uppercase"
                  />
                  {quotePayment.isPending && !fieldState.invalid && (
                    <p className="text-xs text-muted-foreground">Memeriksa kode promo...</p>
                  )}
                  {pricing.promoApplied && !fieldState.invalid && (
                    <p className="text-xs font-medium text-emerald-400">Kode promo berhasil diterapkan.</p>
                  )}
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="paymentProof"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FileUpload
                    value={field.value}
                    onChange={field.onChange}
                    folder="/payment-proofs"
                    purpose="PAYMENT_PROOF"
                    label="Upload Bukti Pembayaran"
                    subLabel="PDF, JPG, PNG, atau WebP maksimal 10 MB"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    maxSizeMB={10}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </div>

        <div className="block ml-auto w-fit">
          <Button type="submit" form="form-payment" disabled={isSubmitting || quotePayment.isPending || !form.formState.isValid} className="mt-8 rounded-md text-2xl font-bold py-6 px-6">
            {isSubmitting ? 'Mengirim...' : 'Kirim'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default FormPayment
