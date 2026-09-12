import { useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Bold, ImagePlus, Italic, List, ListOrdered, Loader2, Minus, Plus, RotateCcw, Underline as UnderlineIcon } from 'lucide-react'
import { IKContext, IKUpload } from 'imagekitio-react'
import { Button } from '@/components/ui/button'
import { useFileUpload } from '@/features/files/hooks/useFileUpload'
import { cn } from '@/lib/utils'

type RichTextEditorProps = { value: string; onChange: (value: string) => void; placeholder: string; className?: string }

const MIN_IMAGE_WIDTH = 15
const MAX_IMAGE_WIDTH = 100
const IMAGE_WIDTH_STEP = 5

const clampImageWidth = (width: number): number =>
  Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, Math.round(width)))

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: MAX_IMAGE_WIDTH,
        parseHTML: (element) => {
          const parsed = Number.parseInt(element.getAttribute('data-width') ?? element.style.width, 10)
          return Number.isNaN(parsed) ? MAX_IMAGE_WIDTH : clampImageWidth(parsed)
        },
        renderHTML: (attributes) => ({
          'data-width': attributes.width,
          style: `width: ${attributes.width}%`,
        }),
      },
    }
  },
})

const imageSizePresets = [25, 50, 75, 100]

function ImageResizeControls({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  return (
    <div className="ml-auto flex items-center gap-1 rounded-full bg-background/80 px-1 py-0.5 ring-1 ring-border">
      <span className="px-1 text-xs font-medium tabular-nums text-muted-foreground">{width}%</span>
      <Button type="button" size="icon-xs" variant="ghost" disabled={width <= MIN_IMAGE_WIDTH} onClick={() => onResize(width - IMAGE_WIDTH_STEP)} aria-label="Kecilkan gambar"><Minus /></Button>
      <Button type="button" size="icon-xs" variant="ghost" disabled={width >= MAX_IMAGE_WIDTH} onClick={() => onResize(width + IMAGE_WIDTH_STEP)} aria-label="Besarkan gambar"><Plus /></Button>
      <Button type="button" size="icon-xs" variant={width === MAX_IMAGE_WIDTH ? 'secondary' : 'ghost'} onClick={() => onResize(MAX_IMAGE_WIDTH)} aria-label="Ukuran penuh"><RotateCcw /></Button>
      {imageSizePresets.map((preset) => (
        <Button key={preset} type="button" size="xs" variant={width === preset ? 'secondary' : 'ghost'} onClick={() => onResize(preset)}>{preset}%</Button>
      ))}
    </div>
  )
}

function ImageUploadButton({ onUpload }: { onUpload: (url: string, name?: string) => void }) {
  const inputRef = useRef<any>(null)
  const { authenticate, registerFile, isRegistering } = useFileUpload()
  const [uploading, setUploading] = useState(false)

  return (
    <IKContext urlEndpoint={import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT} publicKey={import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY} authenticator={authenticate}>
      <Button type="button" size="icon-sm" variant="ghost" disabled={uploading || isRegistering} onClick={() => inputRef.current?.click()} aria-label="Sisipkan gambar">
        {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
      </Button>
      <IKUpload
        ref={inputRef}
        hidden
        accept="image/png,image/jpeg,image/webp"
        folder="/isac-2026/exams"
        useUniqueFileName
        checks={'"file.size" < "5mb"'}
        onUploadStart={() => setUploading(true)}
        onError={() => setUploading(false)}
        onSuccess={async (result: any) => {
          try {
            await registerFile({ file_id: result.fileId, url: result.url, purpose: 'EXAM_IMAGE' })
            onUpload(result.url, result.name)
          } finally {
            setUploading(false)
          }
        }}
      />
    </IKContext>
  )
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: 'min-h-32 px-4 py-3 outline-none prose prose-sm max-w-none dark:prose-invert [&_img]:mx-auto [&_img]:h-auto [&_img]:rounded-xl' } },
  })

  if (!editor) return <div className="min-h-40 animate-pulse rounded-2xl bg-muted" />

  const { selection } = editor.state
  const isSelectedImage = selection instanceof NodeSelection && selection.node.type.name === ResizableImage.name
  const selectedImageWidth = isSelectedImage ? clampImageWidth(Number(selection.node.attrs.width)) : MAX_IMAGE_WIDTH

  const resizeImage = (width: number) => {
    editor.chain().focus().updateAttributes(ResizableImage.name, { width: clampImageWidth(width) }).run()
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-background/50', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-2">
        <Button type="button" size="icon-sm" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Tebal"><Bold /></Button>
        <Button type="button" size="icon-sm" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Miring"><Italic /></Button>
        <Button type="button" size="icon-sm" variant={editor.isActive('underline') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Garis bawah"><UnderlineIcon /></Button>
        <Button type="button" size="icon-sm" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Daftar"><List /></Button>
        <Button type="button" size="icon-sm" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Daftar bernomor"><ListOrdered /></Button>
        <ImageUploadButton onUpload={(url, name) => editor.chain().focus().setImage({ src: url, alt: name ?? 'Gambar soal', width: MAX_IMAGE_WIDTH }).run()} />
        {isSelectedImage && <ImageResizeControls width={selectedImageWidth} onResize={resizeImage} />}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
