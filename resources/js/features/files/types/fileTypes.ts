export type FilePurpose = 'PAYMENT_PROOF' | 'MEMBER_PHOTO' | 'BATCH_MODULE' | 'EXAM_IMAGE' | 'SUBMISSION'
export type FileReference = { id: string; fileId: string; url: string; purpose?: FilePurpose; name?: string }
export type UploadedServerData = { id?: string; fileId?: string; url?: string; purpose?: FilePurpose }

export const uploadRoutes: Record<FilePurpose, string> = {
  PAYMENT_PROOF: 'paymentProof',
  MEMBER_PHOTO: 'memberPhoto',
  SUBMISSION: 'submission',
  BATCH_MODULE: 'batchModule',
  EXAM_IMAGE: 'examImage',
}
