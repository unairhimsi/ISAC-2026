import { z } from 'zod'

export const paymentProofSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().min(1),
  url: z.string().url(),
  name: z.string().optional(),
})

export const uploadPaymentSchema = z.object({
  payment_method: z.enum(['BANK_TRANSFER', 'QRIS']),
  promo_code: z.string().trim().max(50, 'Kode promo maksimal 50 karakter'),
  transaction_id: z.string().trim().max(50, 'No. referensi maksimal 50 karakter').optional(),
  paymentProof: paymentProofSchema.nullable().refine(Boolean, 'Bukti pembayaran wajib diunggah'),
})

export type PaymentProof = z.infer<typeof paymentProofSchema>
export type UploadPaymentInput = z.infer<typeof uploadPaymentSchema>
