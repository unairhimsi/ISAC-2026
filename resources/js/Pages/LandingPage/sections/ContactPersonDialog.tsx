import { useState } from 'react'
import { Mail, X } from 'lucide-react'
import {
  CONTACT_EMAIL,
  CONTACT_GROUPS,
  CONTACT_INSTAGRAM_LABEL,
  CONTACT_INSTAGRAM_URL,
  buildWaLink,
  type ContactPerson,
} from '@/constants/contactPersons'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

export function ContactPersonDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copiedEmail, setCopiedEmail] = useState(false)

  const openWa = (contact: ContactPerson) => {
    const message = `Halo kak ${contact.name}, saya ingin bertanya tentang ISAC 2026.`
    window.open(buildWaLink(contact, message), '_blank', 'noreferrer')
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopiedEmail(true)
      window.setTimeout(() => setCopiedEmail(false), 2000)
    } catch {
      window.location.href = `mailto:${CONTACT_EMAIL}`
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 transition-all duration-300 ${
        open ? 'visible opacity-100' : 'invisible opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Kontak panitia ISAC 2026"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="relative z-10 w-full max-w-lg scale-100 overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-b from-purple-950/95 to-slate-950/95 shadow-[0_0_50px_rgba(147,51,234,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6 pb-5">
          <div>
            <h3 className="text-xl font-extrabold text-white">Hubungi Panitia ISAC 2026</h3>
            <p className="mt-1 text-sm text-white/70">
              Klik nomor di bawah untuk langsung chat via WhatsApp sesuai cabang lomba.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup dialog kontak"
            className="rounded-full border border-white/20 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
          {CONTACT_GROUPS.map((group) => (
            <div key={group.branch}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                {group.branch}
              </p>
              <div className="space-y-2">
                {group.contacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => openWa(contact)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-3 text-left transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <WhatsAppIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">{contact.name}</span>
                      <span className="block font-mono text-xs text-white/60">{contact.phoneLocal}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Chat
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-300">Kanal Lain</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={CONTACT_INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-3 transition-colors hover:border-pink-400/60 hover:bg-pink-500/10"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-pink-400">
                  <InstagramIcon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white">Instagram</span>
                  <span className="block truncate text-xs text-white/60">{CONTACT_INSTAGRAM_LABEL}</span>
                </span>
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-3 text-left transition-colors hover:border-amber-400/60 hover:bg-amber-500/10"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                  <Mail className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">Email ISAC</span>
                  <span className="block truncate text-xs text-white/60">{CONTACT_EMAIL}</span>
                </span>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                  {copiedEmail ? 'Tersalin' : 'Salin'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4 text-center text-xs text-white/50">
          Layanan resmi panitia ISAC 2026 — Hati-hati terhadap penipuan yang mengatasnamakan panitia.
        </div>
      </div>
    </div>
  )
}

export { WhatsAppIcon }
